"""Processus worker : `python -m app.workers.main` (production) — outbox + planificateur.

En développement (WORKER_INLINE=true), les mêmes boucles tournent dans le processus API.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import time

from app.core.config import settings
from app.core.logging import setup_logging

log = logging.getLogger("globus.worker")


def _loop_outbox(stop: list[bool]) -> None:
    from app.workers import outbox

    while not stop[0]:
        try:
            processed = outbox.run_once()
            outbox.pending_count()
        except Exception:
            log.exception("outbox_loop_error")
            processed = 0
        if processed == 0:
            time.sleep(1.0)


def _loop_scheduler(stop: list[bool]) -> None:
    from app.workers import scheduler

    while not stop[0]:
        try:
            scheduler.tick()
        except Exception:
            log.exception("scheduler_loop_error")
        time.sleep(15)


async def run_inline(stop_event: asyncio.Event) -> None:
    """Boucles asynchrones (dans le processus API) : délègue le travail bloquant aux threads."""
    from app.workers import outbox, scheduler

    async def outbox_loop() -> None:
        while not stop_event.is_set():
            try:
                processed = await asyncio.to_thread(outbox.run_once)
            except Exception:
                log.exception("outbox_inline_error")
                processed = 0
            if processed == 0:
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=1.0)
                except TimeoutError:
                    pass

    async def scheduler_loop() -> None:
        await asyncio.sleep(5)
        while not stop_event.is_set():
            try:
                await asyncio.to_thread(scheduler.tick)
            except Exception:
                log.exception("scheduler_inline_error")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=15.0)
            except TimeoutError:
                pass

    await asyncio.gather(outbox_loop(), scheduler_loop())


def main() -> None:
    import threading

    setup_logging()
    from app.core.database import SessionLocal
    from app.modules.system.bootstrap import bootstrap

    with SessionLocal() as db:
        bootstrap(db)
    stop = [False]

    def _stop(*_: object) -> None:
        stop[0] = True

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    threads = [
        threading.Thread(target=_loop_outbox, args=(stop,), daemon=True),
        threading.Thread(target=_loop_scheduler, args=(stop,), daemon=True),
    ]
    for t in threads:
        t.start()
    log.info("worker_started", extra={"env": settings.ENV})
    while not stop[0]:
        time.sleep(1)
    log.info("worker_stopped")


if __name__ == "__main__":
    main()
