import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

import '../project.dart';

const _docTypes = {
  'plan': 'Plans',
  'maquette_bim': 'Maquettes BIM',
  'contrat': 'Contrats',
  'devis': 'Devis',
  'facture': 'Factures',
  'pv': 'Procès-verbaux',
  'rapport': 'Rapports',
  'permis': 'Permis et autorisations',
  'note_calcul': 'Notes de calcul',
  'photo': 'Photos',
  'autre': 'Autres documents',
};

/// Documents publiés : version en vigueur uniquement, téléchargement tracé et filigrané, authenticité vérifiable.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});
  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  String _q = '';
  String? _type;

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/documents',
        builder: (context, data, _) {
          final all = listOf(data);
          final filtered = all
              .where((d) => (_type == null || d.s('type') == _type) && (_q.isEmpty || d.s('title').toLowerCase().contains(_q.toLowerCase())))
              .toList();
          final groups = <String, List<J>>{};
          for (final d in filtered) {
            (groups[d.s('type')] ??= []).add(d);
          }
          final types = {for (final d in all) d.s('type')}.toList();
          return PageList(
            children: [
              const PageHeader(
                title: 'Documents',
                subtitle: 'Seule la version en vigueur de chaque document est publiée ; les téléchargements sont tracés et filigranés.',
              ),
              TextField(
                decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher un document', isDense: true),
                onChanged: (v) => setState(() => _q = v.trim()),
              ),
              if (types.length > 1)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      ChoiceChip(label: const Text('Tous les types'), selected: _type == null, onSelected: (_) => setState(() => _type = null)),
                      for (final t in types)
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(label: Text(_docTypes[t] ?? optionLabel(t)), selected: _type == t, onSelected: (_) => setState(() => _type = t)),
                        ),
                    ],
                  ),
                ),
              if (groups.isEmpty)
                const EmptyView(
                  icon: Icons.description_outlined,
                  title: 'Aucun document publié',
                  text: 'Plans, contrats, procès-verbaux et rapports apparaîtront ici dès leur publication.',
                ),
              for (final entry in groups.entries)
                SectionCard(
                  title: _docTypes[entry.key] ?? optionLabel(entry.key),
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final (i, d) in entry.value.indexed) ...[
                        if (i > 0) const Divider(height: 1),
                        ListTile(
                          leading: const Icon(Icons.description_outlined, color: GlobusColors.primary),
                          title: Row(
                            children: [
                              Flexible(child: Text(d.s('title'))),
                              const SizedBox(width: 6),
                              ToneBadge(d.s('version'), tone: Tone.info),
                            ],
                          ),
                          subtitle: Text(
                            [
                              'Publié le ${date(d['published_at'])}',
                              if (d.has('size')) fileSize(d['size']),
                              if (d.has('discipline')) optionLabel(d.s('discipline')),
                            ].join(' · '),
                          ),
                          onTap: () => openRemoteFile(context, d.s('url'), filename: d.str('filename')),
                          trailing: PopupMenuButton<String>(
                            tooltip: 'Actions',
                            onSelected: (a) {
                              if (a == 'open') openRemoteFile(context, d.s('url'), filename: d.str('filename'));
                              if (a == 'auth') {
                                openExternal(
                                  context,
                                  d.s('authenticity_url').startsWith('http') ? d.s('authenticity_url') : '${context.config.origin}${d.s('authenticity_url')}',
                                );
                              }
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(
                                value: 'open',
                                child: ListTile(leading: Icon(Icons.download), title: Text('Ouvrir')),
                              ),
                              PopupMenuItem(
                                value: 'auth',
                                child: ListTile(leading: Icon(Icons.verified_outlined), title: Text('Authenticité')),
                              ),
                            ],
                          ),
                        ),
                      ],
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

/// Preuves certifiées : empreintes SHA-256 des décisions, documents et lots de photos ; vérification d'un fichier
/// sur le téléphone (le fichier ne quitte jamais l'appareil) ; certificat PDF.
class ProofsScreen extends StatelessWidget {
  const ProofsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/proofs',
        builder: (context, data, _) {
          final proofs = listOf(data);
          return PageList(
            children: [
              const PageHeader(
                title: 'Preuves certifiées',
                subtitle: 'Chaque décision validée, document publié et lot de photos de votre chantier est scellé par son empreinte numérique : impossible de le modifier sans que cela se voie.',
              ),
              const AlertBox(
                tone: Tone.info,
                title: 'Comment ça marche ?',
                message: 'Une empreinte SHA-256 identifie un fichier de manière unique. Choisissez un fichier que vous détenez : son empreinte est recalculée sur votre téléphone et comparée à celle certifiée le jour J. Les preuves horodatées publiquement (OpenTimestamps) sont vérifiables sans dépendre de GLOBUS.',
              ),
              SectionCard(
                icon: Icons.verified_user_outlined,
                title: '${proofs.length} preuve(s)',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (proofs.isEmpty)
                      const EmptyView(
                        title: "Aucune preuve pour l'instant",
                        text: 'Vos décisions validées et les photos publiées de votre chantier apparaîtront ici, certifiées.',
                      ),
                    for (final (i, p) in proofs.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(p.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                                ),
                                if (p.b('revoked')) const ToneBadge('Révoquée', tone: Tone.danger),
                              ],
                            ),
                            Text(
                              '${p.s('subject')} · ${p.s('number')} · certifiée le ${dateTime(p['issued_at'])}${p.has('anchored_at') ? ' · horodatage public OpenTimestamps' : ''}${p.list('leaves').isNotEmpty ? ' · ${p.list('leaves').length} pièce(s)' : ''}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            SelectableText(p.s('sha256'), style: const TextStyle(fontFamily: 'monospace', fontSize: 10.5)),
                            Wrap(
                              spacing: 6,
                              children: [
                                TextButton.icon(
                                  onPressed: () => showModalBottomSheet<void>(
                                    context: context,
                                    builder: (_) => ProofFileCheck(sha256: p.s('sha256'), leaves: p.list('leaves')),
                                  ),
                                  icon: const Icon(Icons.find_in_page_outlined, size: 18),
                                  label: const Text('Vérifier un fichier'),
                                ),
                                TextButton.icon(
                                  onPressed: () => openRemoteFile(context, '/proofs/${p.s('id')}/certificate.pdf', filename: 'certificat-${p.s('number')}.pdf'),
                                  icon: const Icon(Icons.download, size: 18),
                                  label: const Text('Certificat'),
                                ),
                                TextButton.icon(
                                  onPressed: () => openExternal(context, '${context.config.origin}/verification/${p.s('public_code')}'),
                                  icon: const Icon(Icons.open_in_new, size: 18),
                                  label: const Text('Page publique'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
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

/// Vérification locale d'un fichier : empreinte SHA-256 calculée sur le téléphone, comparée à l'empreinte
/// certifiée ou à celle d'une pièce du lot.
class ProofFileCheck extends StatefulWidget {
  const ProofFileCheck({super.key, required this.sha256, required this.leaves});
  final String sha256;
  final List<J> leaves;
  @override
  State<ProofFileCheck> createState() => _ProofFileCheckState();
}

class _ProofFileCheckState extends State<ProofFileCheck> {
  String _status = 'idle';
  String? _name;
  String? _hash;
  String? _label;

  Future<void> _check() async {
    final file = await FilePicker.pickFile();
    if (file == null) return;
    setState(() {
      _status = 'busy';
      _name = file.name;
    });
    final digest = sha256.convert(await file.readAsBytes()).toString();
    final leaf = widget.leaves.where((l) => l.s('sha256') == digest).firstOrNull;
    setState(() {
      _hash = digest;
      _label = leaf?.str('label');
      _status = digest == widget.sha256 || leaf != null ? 'match' : 'nomatch';
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Vérifier un fichier en votre possession', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('Le calcul se fait sur votre téléphone : votre fichier ne le quitte jamais.', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: _status == 'busy' ? null : _check,
              icon: const Icon(Icons.file_open_outlined),
              label: const Text('Choisir le fichier à comparer'),
            ),
            const SizedBox(height: 12),
            if (_status == 'busy')
              Row(
                children: [
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                  const SizedBox(width: 10),
                  Expanded(child: Text("Calcul de l'empreinte de $_name…")),
                ],
              ),
            if (_status == 'match')
              AlertBox(
                tone: Tone.success,
                title: 'Fichier identique',
                message:
                    'Identique à ${_label != null ? 'la pièce « $_label » du lot certifié' : "l'original certifié"} : il n\'a pas été modifié depuis sa certification.',
              ),
            if (_status == 'nomatch')
              AlertBox(
                tone: Tone.danger,
                title: 'Empreinte différente',
                message: "Ce fichier n'est pas celui qui a été certifié (ou il a été modifié).\n$_hash",
              ),
          ],
        ),
      ),
    );
  }
}
