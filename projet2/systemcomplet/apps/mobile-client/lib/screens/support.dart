import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../project.dart';

const _statuses = ['new', 'assigned', 'diagnosis', 'scheduled', 'in_progress', 'resolved', 'closed', 'reopened'];
const _categories = ['etancheite', 'plomberie', 'electricite', 'fissure', 'menuiserie', 'peinture', 'equipement', 'autre'];
const _priorities = ['low', 'normal', 'high', 'urgent'];

/// SAV et garanties : demandes (filtre de statut), nouvelle demande avec photos, suivi jusqu'à la validation.
class SupportListScreen extends StatefulWidget {
  const SupportListScreen({super.key});
  @override
  State<SupportListScreen> createState() => _SupportListScreenState();
}

class _SupportListScreenState extends State<SupportListScreen> {
  String? _status;
  final _list = PagedListController();

  Future<void> _new() async {
    final project = context.read<ClientProjects>().project;
    final created = await Navigator.of(context, rootNavigator: true).push<J>(MaterialPageRoute(builder: (_) => NewTicketScreen(projectId: project?.s('id'))));
    if (created != null && mounted) {
      await _list.reload();
      if (mounted) await context.push('/espace-client/sav/${created.s('id')}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final project = context.watch<ClientProjects>().project;
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'sav-new',
        onPressed: _new,
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle demande'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const PageHeader(
                  title: 'SAV et garanties',
                  subtitle: "Signalez un désordre : délais d'intervention garantis, suivi et validation de la réparation.",
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      ChoiceChip(label: const Text('Tous'), selected: _status == null, onSelected: (_) => setState(() => _status = null)),
                      for (final s in _statuses)
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(label: Text(optionLabel(s)), selected: _status == s, onSelected: (_) => setState(() => _status = s)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: PagedListView(
              path: '/support/tickets',
              controller: _list,
              query: {'project_id': project?.s('id'), 'status': _status},
              refreshOn: const ['notification'],
              padding: const EdgeInsets.only(bottom: 96),
              empty: EmptyView(
                icon: Icons.support_agent,
                title: 'Aucune demande',
                text: 'Vos demandes SAV et leur suivi apparaîtront ici.',
                action: FilledButton.icon(onPressed: _new, icon: const Icon(Icons.support_agent), label: const Text('Signaler un problème')),
              ),
              itemBuilder: (context, t, _) => ListTile(
                onTap: () => context.push('/espace-client/sav/${t.s('id')}'),
                title: Text('${t.s('number')} · ${t.s('subject')}', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  [
                    optionLabel(t.s('category')),
                    optionLabel(t.s('priority')),
                    'ouvert le ${dateTime(t['created_at'])}',
                    if (t.has('resolution_due_at')) 'résolution attendue ${dateTime(t['resolution_due_at'])}${t.b('resolution_breached') ? ' (dépassé)' : ''}',
                  ].join(' · '),
                ),
                trailing: StatusBadge(t.s('status')),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Nouvelle demande SAV : catégorie, priorité, objet, description, localisation, photos.
class NewTicketScreen extends StatefulWidget {
  const NewTicketScreen({super.key, this.projectId});
  final String? projectId;
  @override
  State<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends State<NewTicketScreen> {
  String _category = 'autre';
  String _priority = 'normal';
  final _subject = TextEditingController();
  final _description = TextEditingController();
  final _location = TextEditingController();
  final List<UploadFile> _photos = [];
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    _location.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = context.api;
      final ticket = J.of(
        await api.post(
          '/support/tickets',
          idempotent: true,
          body: {
            'project_id': widget.projectId,
            'category': _category,
            'priority': _priority,
            'subject': _subject.text.trim(),
            'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
            'location': _location.text.trim().isEmpty ? null : _location.text.trim(),
          },
        ),
      );
      for (final p in _photos) {
        await api.upload('/support/tickets/${ticket.s('id')}/attachments', files: [p], fields: {'kind': 'photo'});
      }
      if (mounted) Navigator.pop(context, ticket);
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle demande SAV')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Catégorie'),
            items: [for (final c in _categories) DropdownMenuItem(value: c, child: Text(optionLabel(c)))],
            onChanged: (v) => setState(() => _category = v ?? 'autre'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Priorité'),
            items: [for (final p in _priorities) DropdownMenuItem(value: p, child: Text(optionLabel(p)))],
            onChanged: (v) => setState(() => _priority = v ?? 'normal'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _subject,
            maxLength: 250,
            decoration: const InputDecoration(labelText: 'Objet *', hintText: 'Ex. infiltration au plafond de la chambre'),
            onChanged: (_) => setState(() {}),
          ),
          TextField(
            controller: _description,
            minLines: 3,
            maxLines: 8,
            maxLength: 8000,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          TextField(
            controller: _location,
            maxLength: 250,
            decoration: const InputDecoration(labelText: 'Localisation', hintText: 'Pièce, niveau, façade…'),
          ),
          const GroupTitle('Photos'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final p in _photos)
                InputChip(avatar: const Icon(Icons.photo, size: 18), label: Text(p.name), onDeleted: () => setState(() => _photos.remove(p))),
              ActionChip(
                avatar: const Icon(Icons.add_a_photo_outlined, size: 18),
                label: const Text('Ajouter'),
                onPressed: () async {
                  final files = await pickAttachments(context, imagesOnly: true);
                  setState(() => _photos.addAll(files));
                },
              ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          const SizedBox(height: 20),
          BusyButton(label: 'Envoyer la demande', expand: true, busy: _busy, onPressed: _subject.text.trim().length < 3 ? null : _submit),
        ],
      ),
    );
  }
}

const _tranquilliteCategories = {
  'foncier': 'Documents fonciers',
  'titre': 'Certificat / titre',
  'permis': 'Permis et autorisations',
  'notarie': 'Actes notariés',
  'verification': 'Vérifications',
  'administratif': 'Dossier administratif',
  'assurance': 'Assurances',
  'autre': 'Autres pièces',
};

/// Dossier Tranquillité (§6.2) : foncier, permis, actes, vérifications — statut, échéances, responsable, preuves.
class TranquilliteScreen extends StatelessWidget {
  const TranquilliteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/tranquillite',
        builder: (context, data, _) {
          final items = listOf(data);
          final groups = <String, List<J>>{};
          for (final i in items) {
            (groups[i.s('category')] ??= []).add(i);
          }
          final today = isoDate(DateTime.now());
          final theme = Theme.of(context);
          return PageList(
            children: [
              const PageHeader(
                title: 'Dossier Tranquillité',
                subtitle: 'Foncier, permis, actes et vérifications : le statut de chaque pièce, ses échéances et ses preuves.',
              ),
              if (items.isEmpty)
                const EmptyView(
                  icon: Icons.folder_special_outlined,
                  title: 'Dossier en cours de constitution',
                  text: 'Votre responsable GLOBUS rassemble les pièces foncières et administratives de votre projet.',
                ),
              for (final entry in groups.entries)
                SectionCard(
                  title: _tranquilliteCategories[entry.key] ?? optionLabel(entry.key),
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final i in entry.value)
                        Builder(
                          builder: (_) {
                            final expired = i.has('expiry_date') && i.s('expiry_date').compareTo(today) < 0;
                            final due = i.date('due_date');
                            final dueSoon = due != null && i.s('due_date').compareTo(today) >= 0 && due.difference(DateTime.now()).inDays < 30;
                            return Padding(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(i.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                                  if (i.has('authority') || i.has('reference_masked'))
                                    Text(
                                      '${i.s('authority')}${i.has('reference_masked') ? ' · réf. ${i.s('reference_masked')}' : ''}',
                                      style: theme.textTheme.bodySmall,
                                    ),
                                  const SizedBox(height: 6),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: [
                                      StatusBadge(i.s('status')),
                                      if (i.has('verified_at')) ToneBadge('Vérifié le ${date(i['verified_at'])}', tone: Tone.success, icon: Icons.verified),
                                      if (i.b('anchored')) const ToneBadge('Empreinte ancrée', tone: Tone.info, icon: Icons.anchor),
                                      if (expired)
                                        const ToneBadge('Expiré', tone: Tone.danger)
                                      else if (dueSoon)
                                        const ToneBadge('Échéance proche', tone: Tone.warning),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    [
                                      if (i.has('issued_date')) 'Délivré le ${date(i['issued_date'])}',
                                      if (i.has('expiry_date')) 'Expire le ${date(i['expiry_date'])}',
                                      if (i.has('due_date')) 'Échéance ${date(i['due_date'])}',
                                      if (i.has('responsible')) i.s('responsible'),
                                      '${i.i('proofs')} preuve(s)',
                                      if (i.has('verified_at')) 'Contrôle : ${dateTime(i['verified_at'])}',
                                    ].join(' · '),
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

const _hints = ['', 'Très décevant', 'Décevant', 'Correct', 'Très bien', 'Exceptionnel'];

/// Mon avis : avis vérifié lié au chantier réel (note, témoignage, photo / vidéo, consentement de publication).
class ReviewScreen extends StatelessWidget {
  const ReviewScreen({super.key, this.projectId});

  /// Projet ciblé par le lien de notification « Votre avis compte » (sinon projet courant).
  final String? projectId;

  @override
  Widget build(BuildContext context) {
    Widget content(String id, String? name) => ApiView(
      path: '/client/projects/$id/review',
      offline: false,
      builder: (context, data, _) {
        final s = J.of(data);
        return PageList(
          children: [
            const PageHeader(
              title: 'Votre avis',
              subtitle: 'Un avis vérifié, lié à votre chantier réel : il guide les futurs clients et nous aide à progresser.',
            ),
            if (s.b('completed'))
              const AlertBox(tone: Tone.success, title: 'Merci !', message: 'Vous avez déjà partagé votre avis sur ce projet.')
            else if (!s.b('eligible'))
              const AlertBox(
                tone: Tone.info,
                title: 'Bientôt',
                message: "Votre avis vous sera demandé à la remise des clés : vous pourrez alors juger l'ensemble du projet.",
              )
            else
              _ReviewForm(projectId: id, projectName: name),
          ],
        );
      },
    );
    if (projectId != null) {
      final p = context.watch<ClientProjects>().projects?.where((x) => x.s('id') == projectId).firstOrNull;
      return content(projectId!, p?.s('name'));
    }
    return WithProject(builder: (context, p) => content(p.s('id'), p.s('name')));
  }
}

class _ReviewForm extends StatefulWidget {
  const _ReviewForm({required this.projectId, this.projectName});
  final String projectId;
  final String? projectName;
  @override
  State<_ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends State<_ReviewForm> {
  int _rating = 0;
  final _comment = TextEditingController();
  final _role = TextEditingController();
  final _location = TextEditingController();
  String _display = 'initials';
  bool _consent = false;
  UploadFile? _photo;
  UploadFile? _video;
  bool _busy = false;
  String? _error;
  bool? _done;

  @override
  void dispose() {
    _comment.dispose();
    _role.dispose();
    _location.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.api.upload(
        '/client/projects/${widget.projectId}/review',
        files: [
          if (_photo != null) UploadFile(name: _photo!.name, path: _photo!.path, bytes: _photo!.bytes, field: 'photo'),
          if (_video != null) UploadFile(name: _video!.name, path: _video!.path, bytes: _video!.bytes, field: 'video'),
        ],
        fields: {
          'rating': _rating,
          'comment': _comment.text.trim(),
          'display': _display,
          'author_role': _role.text.trim().isEmpty ? null : _role.text.trim(),
          'location': _location.text.trim().isEmpty ? null : _location.text.trim(),
          'consent_publish': _consent ? 'true' : 'false',
        },
      );
      setState(() => _done = _consent);
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Icon(Icons.check_circle, color: GlobusColors.success, size: 56),
              const SizedBox(height: 10),
              Text('Merci ${context.auth.user?.firstName ?? ''} !', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 6),
              Text(
                _done!
                    ? 'Votre avis sera publié après une relecture de forme (aucune modification de votre note ni de vos propos).'
                    : 'Votre avis reste interne : il nous aide à progresser, sans être publié.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Votre note globale${widget.projectName != null ? ' pour « ${widget.projectName} »' : ''}'),
            Row(
              children: [
                for (var n = 1; n <= 5; n++)
                  IconButton(
                    tooltip: '$n sur 5',
                    onPressed: () => setState(() => _rating = n),
                    icon: Icon(n <= _rating ? Icons.star : Icons.star_border, color: GlobusColors.accent, size: 34),
                  ),
              ],
            ),
            if (_rating > 0)
              Text(
                _hints[_rating],
                style: const TextStyle(color: GlobusTokens.accent600, fontWeight: FontWeight.w600),
              ),
            const SizedBox(height: 10),
            TextField(
              controller: _comment,
              minLines: 4,
              maxLines: 8,
              maxLength: 1500,
              decoration: InputDecoration(
                labelText: 'Votre témoignage *',
                hintText: 'Accueil, respect des délais, qualité des finitions, suivi du chantier…',
                helperText: '${_comment.text.trim().length}/20 caractères minimum',
              ),
              onChanged: (_) => setState(() {}),
            ),
            DropdownButtonFormField<String>(
              initialValue: _display,
              decoration: const InputDecoration(labelText: 'Affichage du nom'),
              items: const [
                DropdownMenuItem(value: 'initials', child: Text('Prénom + initiale')),
                DropdownMenuItem(value: 'full', child: Text('Nom complet')),
              ],
              onChanged: (v) => setState(() => _display = v ?? 'initials'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _role,
              maxLength: 150,
              decoration: const InputDecoration(labelText: 'Vous êtes (facultatif)', hintText: 'Particulier, gérant de PME…'),
            ),
            TextField(
              controller: _location,
              maxLength: 150,
              decoration: const InputDecoration(labelText: 'Ville (facultatif)', hintText: 'Douala'),
            ),
            OutlinedButton.icon(
              onPressed: () async {
                final f = await pickAttachments(context, imagesOnly: true, multiple: false);
                if (f.isNotEmpty) setState(() => _photo = f.first);
              },
              icon: const Icon(Icons.photo_camera_outlined),
              label: Text(_photo?.name ?? 'Ajouter une photo de votre réalisation'),
            ),
            const SizedBox(height: 6),
            OutlinedButton.icon(
              onPressed: () async {
                final f = await pickAttachments(context, allowVideo: true, multiple: false);
                if (f.isNotEmpty) setState(() => _video = f.first);
              },
              icon: const Icon(Icons.videocam_outlined),
              label: Text(_video?.name ?? 'Ajouter une courte vidéo (facultatif)'),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
              title: const Text("J'autorise GLOBUS ENGINEERING à publier mon avis (note, texte, photo / vidéo) sur son site, avec le nom choisi ci-dessus."),
              subtitle: const Text('Sans cette case, votre avis reste interne. Vous pouvez retirer votre accord à tout moment.'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
              onPressed: _rating == 0 || _comment.text.trim().length < 20 || _busy ? null : _send,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Envoyer mon avis'),
            ),
          ],
        ),
      ),
    );
  }
}
