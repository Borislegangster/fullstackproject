"""Planification (§7 Planification) : calendriers ouvrés, dépendances FS/SS/FF/SF avec décalage, calcul du
chemin critique (CPM : passes avant/arrière, marges), replanification, baseline et écarts, capacité."""

from __future__ import annotations

import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.modules.projects.models import Project, ScheduleBaseline, Task, TaskDependency, WorkCalendar


@dataclass
class Calendar:
    working_days: set[int] = field(default_factory=lambda: {0, 1, 2, 3, 4, 5})
    holidays: set[date] = field(default_factory=set)

    def is_working(self, day: date) -> bool:
        return day.weekday() in self.working_days and day not in self.holidays

    def next_working(self, day: date) -> date:
        guard = 0
        while not self.is_working(day):
            day += timedelta(days=1)
            guard += 1
            if guard > 366:
                raise BusinessRuleError("Calendrier sans jour ouvré")
        return day

    def add_working_days(self, start: date, days: int) -> date:
        """Date de fin pour une durée en jours ouvrés (durée 1 = même jour)."""
        current = self.next_working(start)
        remaining = max(1, days) - 1
        while remaining > 0:
            current += timedelta(days=1)
            if self.is_working(current):
                remaining -= 1
        return current

    def shift(self, day: date, offset: int) -> date:
        """Décale d'un nombre (positif/négatif) de jours ouvrés."""
        step = 1 if offset >= 0 else -1
        current = day
        moved = 0
        while moved < abs(offset):
            current += timedelta(days=step)
            if self.is_working(current):
                moved += 1
        return current

    def working_between(self, start: date, end: date) -> int:
        if end < start:
            return -self.working_between(end, start)
        count, current = 0, start
        while current <= end:
            if self.is_working(current):
                count += 1
            current += timedelta(days=1)
        return count


def load_calendar(db: Session, project_id: uuid.UUID) -> Calendar:
    row = db.execute(select(WorkCalendar).where(WorkCalendar.project_id == project_id)).scalars().first()
    if row is None:
        row = db.execute(select(WorkCalendar).where(WorkCalendar.project_id.is_(None))).scalars().first()
    if row is None:
        return Calendar()
    holidays = set()
    for h in row.holidays or []:
        try:
            holidays.add(date.fromisoformat(str(h)))
        except ValueError:
            continue
    return Calendar(working_days=set(int(d) for d in (row.working_days or [0, 1, 2, 3, 4, 5])), holidays=holidays)


def _topological(tasks: dict[uuid.UUID, Task], deps: list[TaskDependency]) -> list[uuid.UUID]:
    indegree: dict[uuid.UUID, int] = {tid: 0 for tid in tasks}
    succ: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for d in deps:
        if d.predecessor_id in tasks and d.successor_id in tasks:
            succ[d.predecessor_id].append(d.successor_id)
            indegree[d.successor_id] += 1
    queue = deque(sorted((t for t, n in indegree.items() if n == 0), key=lambda t: str(t)))
    order: list[uuid.UUID] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in succ[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    if len(order) != len(tasks):
        raise BusinessRuleError("Dépendances circulaires dans le planning", code="CIRCULAR_DEPENDENCY")
    return order


def would_create_cycle(db: Session, project_id: uuid.UUID, predecessor: uuid.UUID, successor: uuid.UUID) -> bool:
    deps = db.execute(select(TaskDependency).where(TaskDependency.project_id == project_id)).scalars().all()
    graph: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for d in deps:
        graph[d.predecessor_id].append(d.successor_id)
    graph[predecessor].append(successor)
    seen, stack = set(), [successor]
    while stack:
        node = stack.pop()
        if node == predecessor:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(graph[node])
    return False


def schedule(db: Session, project: Project, *, apply: bool = True) -> dict[str, Any]:
    """Passe avant (dates au plus tôt) en respectant dépendances, contraintes et avancement réel ;
    passe arrière (au plus tard), marges et chemin critique. Si `apply`, met à jour les dates prévues."""
    cal = load_calendar(db, project.id)
    tasks = {
        t.id: t
        for t in db.execute(select(Task).where(Task.project_id == project.id, Task.deleted_at.is_(None))).scalars()
    }
    if not tasks:
        return {"tasks": [], "critical_path": [], "end_date": None}
    deps = list(db.execute(select(TaskDependency).where(TaskDependency.project_id == project.id)).scalars())
    order = _topological(tasks, deps)
    preds: dict[uuid.UUID, list[TaskDependency]] = defaultdict(list)
    succs: dict[uuid.UUID, list[TaskDependency]] = defaultdict(list)
    for d in deps:
        if d.predecessor_id in tasks and d.successor_id in tasks:
            preds[d.successor_id].append(d)
            succs[d.predecessor_id].append(d)
    project_start = (
        project.start_actual
        or project.start_planned
        or min((t.start_planned for t in tasks.values() if t.start_planned), default=date.today())
    )
    es: dict[uuid.UUID, date] = {}
    ef: dict[uuid.UUID, date] = {}
    for tid in order:
        task = tasks[tid]
        duration = max(1, task.duration_days or 1) if not task.is_milestone else 1
        if task.start_actual:
            start = task.start_actual
        else:
            start = cal.next_working(task.start_planned or project_start)
            if task.constraint_type == "snet" and task.constraint_date:
                start = max(start, cal.next_working(task.constraint_date))
            for d in preds[tid]:
                lag = d.lag_days or 0
                if d.type == "FS":
                    candidate = (
                        cal.shift(ef[d.predecessor_id], 1 + lag)
                        if lag >= 0
                        else cal.shift(ef[d.predecessor_id], lag + 1)
                    )
                elif d.type == "SS":
                    candidate = cal.shift(es[d.predecessor_id], lag)
                elif d.type == "FF":
                    candidate = cal.shift(cal.shift(ef[d.predecessor_id], lag), -(duration - 1))
                else:  # SF
                    candidate = cal.shift(cal.shift(es[d.predecessor_id], lag), -(duration - 1))
                start = max(start, cal.next_working(candidate))
        es[tid] = start
        if task.end_actual:
            ef[tid] = task.end_actual
        else:
            ef[tid] = cal.add_working_days(start, duration)
    project_end = max(ef.values())
    ls: dict[uuid.UUID, date] = {}
    lf: dict[uuid.UUID, date] = {}
    for tid in reversed(order):
        task = tasks[tid]
        duration = max(1, task.duration_days or 1) if not task.is_milestone else 1
        finish = project_end
        if task.constraint_type == "fnlt" and task.constraint_date:
            finish = min(finish, task.constraint_date)
        for d in succs[tid]:
            lag = d.lag_days or 0
            if d.type == "FS":
                candidate = cal.shift(ls[d.successor_id], -(1 + lag))
            elif d.type == "SS":
                candidate = cal.shift(cal.shift(ls[d.successor_id], -lag), duration - 1)
            elif d.type == "FF":
                candidate = cal.shift(lf[d.successor_id], -lag)
            else:
                candidate = cal.shift(lf[d.successor_id], -lag)
            finish = min(finish, candidate)
        lf[tid] = finish
        ls[tid] = cal.shift(finish, -(duration - 1))
    result = []
    critical: list[str] = []
    for tid in order:
        task = tasks[tid]
        total_float = (
            cal.working_between(es[tid], ls[tid]) - 1
            if ls[tid] >= es[tid]
            else -cal.working_between(ls[tid], es[tid]) + 1
        )
        is_critical = total_float <= 0 and task.status != "done"
        if is_critical:
            critical.append(str(tid))
        if apply and not task.start_actual:
            task.start_planned = es[tid]
        if apply and not task.end_actual:
            task.end_planned = ef[tid]
        variance = None
        if task.baseline_end:
            variance = (
                cal.working_between(task.baseline_end, ef[tid]) - 1
                if ef[tid] >= task.baseline_end
                else -(cal.working_between(ef[tid], task.baseline_end) - 1)
            )
        result.append(
            {
                "id": str(tid),
                "es": es[tid],
                "ef": ef[tid],
                "ls": ls[tid],
                "lf": lf[tid],
                "total_float": total_float,
                "critical": is_critical,
                "baseline_variance_days": variance,
            }
        )
    if apply:
        project.end_planned = project_end if not project.end_actual else project.end_planned
        db.flush()
    return {"tasks": result, "critical_path": critical, "end_date": project_end, "start_date": project_start}


def save_baseline(
    db: Session, project: Project, *, name: str, reason: str | None, user_id: uuid.UUID
) -> ScheduleBaseline:
    tasks = db.execute(select(Task).where(Task.project_id == project.id, Task.deleted_at.is_(None))).scalars().all()
    number = len(db.execute(select(ScheduleBaseline.id).where(ScheduleBaseline.project_id == project.id)).all()) + 1
    for previous in db.execute(
        select(ScheduleBaseline).where(ScheduleBaseline.project_id == project.id, ScheduleBaseline.is_current.is_(True))
    ).scalars():
        previous.is_current = False
    data = {
        str(t.id): {
            "start": t.start_planned.isoformat() if t.start_planned else None,
            "end": t.end_planned.isoformat() if t.end_planned else None,
            "title": t.title,
            "duration": t.duration_days,
        }
        for t in tasks
    }
    for t in tasks:
        t.baseline_start, t.baseline_end = t.start_planned, t.end_planned
    baseline = ScheduleBaseline(
        project_id=project.id,
        name=name,
        number=number,
        data=data,
        is_current=True,
        created_by_id=user_id,
        reason=reason,
    )
    db.add(baseline)
    db.flush()
    return baseline


def gantt(db: Session, project: Project) -> dict[str, Any]:
    tasks = (
        db.execute(
            select(Task)
            .where(Task.project_id == project.id, Task.deleted_at.is_(None))
            .order_by(Task.sort_order, Task.start_planned)
        )
        .scalars()
        .all()
    )
    deps = db.execute(select(TaskDependency).where(TaskDependency.project_id == project.id)).scalars().all()
    cpm = schedule(db, project, apply=False) if tasks else {"tasks": [], "critical_path": []}
    info = {row["id"]: row for row in cpm["tasks"]}
    return {
        "project": {
            "id": project.id,
            "code": project.code,
            "name": project.name,
            "start": project.start_planned,
            "end": project.end_planned,
        },
        "tasks": [
            {
                "id": t.id,
                "parent_id": t.parent_id,
                "phase_id": t.phase_id,
                "lot_id": t.lot_id,
                "wbs": t.wbs_code,
                "title": t.title,
                "start": t.start_planned,
                "end": t.end_planned,
                "baseline_start": t.baseline_start,
                "baseline_end": t.baseline_end,
                "progress": t.progress_pct,
                "status": t.status,
                "milestone": t.is_milestone,
                "assignees": [str(a.user_id) for a in t.assignments if a.user_id],
                "critical": info.get(str(t.id), {}).get("critical", False),
                "float": info.get(str(t.id), {}).get("total_float"),
            }
            for t in tasks
        ],
        "links": [
            {"id": d.id, "from": d.predecessor_id, "to": d.successor_id, "type": d.type, "lag": d.lag_days}
            for d in deps
        ],
        "critical_path": cpm["critical_path"],
    }


def capacity(db: Session, project_ids: list[uuid.UUID] | None, start: date, weeks: int = 8) -> list[dict[str, Any]]:
    """Charge hebdomadaire par personne (allocation × jours de tâches actives)."""
    stmt = select(Task).where(
        Task.deleted_at.is_(None),
        Task.status.in_(["todo", "in_progress", "blocked"]),
        Task.start_planned.is_not(None),
        Task.end_planned.is_not(None),
    )
    if project_ids is not None:
        stmt = stmt.where(Task.project_id.in_(project_ids))
    load: dict[tuple[str, int], Decimal] = defaultdict(Decimal)
    for task in db.execute(stmt).scalars():
        for assignment in task.assignments:
            if not assignment.user_id:
                continue
            for week in range(weeks):
                w_start = start + timedelta(weeks=week)
                w_end = w_start + timedelta(days=6)
                overlap_start = max(w_start, task.start_planned)
                overlap_end = min(w_end, task.end_planned)
                if overlap_end >= overlap_start:
                    days = sum(
                        1
                        for i in range((overlap_end - overlap_start).days + 1)
                        if (overlap_start + timedelta(days=i)).weekday() < 6
                    )
                    load[(str(assignment.user_id), week)] += Decimal(days) * Decimal(assignment.allocation_pct) / 100
    users: dict[str, list[float]] = defaultdict(lambda: [0.0] * weeks)
    for (user_id, week), days in load.items():
        users[user_id][week] = float(days)
    return [
        {
            "user_id": uid,
            "weeks": [
                {"week_start": (start + timedelta(weeks=i)).isoformat(), "days": d, "overload": d > 6}
                for i, d in enumerate(values)
            ],
        }
        for uid, values in users.items()
    ]
