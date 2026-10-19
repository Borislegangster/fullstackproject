/// Robot de parcours des applications GLOBUS : ouvre chaque rubrique, la première fiche de chaque liste, chaque
/// formulaire et chaque action (sans jamais valider), et relève automatiquement ce qu'un utilisateur verrait de faux :
/// erreurs, formulaires ou pages indisponibles, libellés anglais ou techniques, valeurs brutes (codes, décimales,
/// dates ISO), exceptions Flutter (débordements de mise en page compris). Captures d'écran de chaque étape.
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'src/curl_adapter.dart';

export 'src/curl_adapter.dart';

/// Anomalie relevée sur un écran.
class Finding {
  const Finding(this.screen, this.kind, this.detail);
  final String screen;
  final String kind;
  final String detail;
  @override
  String toString() => '[$kind] $screen : $detail';
}

/// Textes d'erreur visibles par l'utilisateur.
const _errorTexts = [
  'Une erreur est survenue',
  'Accès non autorisé',
  'Élément introuvable',
  'Formulaire indisponible',
  "Cette page n'existe pas",
  'Page indisponible',
  'Données invalides',
  'Service indisponible',
];

/// Fragments techniques qui ne doivent jamais apparaître.
final _technical = RegExp(
  r"(Instance of '|NoSuchMethodError|is not a subtype|Null check operator|RangeError|FormatException|TypeError|"
  r'Exception:|DioException|SocketException|HTTP \d{3}|_JsonMap|\bnull\b$|^null$|^true$|^false$)',
);

/// Mots anglais typiques d'un nom de champ non traduit (libellés de fiche et de formulaire).
final _englishWord = RegExp(
  r'(?<![A-Za-zÀ-ÿ])(Created|Updated|Deleted|Won|Lost|Approved|Submitted|Closed|Opened|Sent|Paid|Issued|Expected|Started|Ended|'
  r'Requested|Cancelled|Canceled|Rejected|Signed|Validated|Received|Count|Name|Status|Amount|Owner|Assigned|Level|'
  r'Stage|Probability|Currency|Kind|Category|Priority|Due|Last|First|Number|Since|Until|Price|Quantity|Unit|Project|'
  r'Supplier|Customer|Item|Items|Lines?|Reason|Comment|Summary|Title|Body|Phone|Address|City|Country|Company|Role|'
  r'User|Team|Start|End|Planned|Actual|Progress|Weight|Size|Url|Link|Enabled|Active|Archived|Published|'
  r'Ordered|Delivered|Confirmed|Completed|Verified|Rated|Read|Seen|Viewed|Converted|Scheduled|Resolved|Escalated|'
  r'Attempts|Retries|Token|Hash|Key)(?![A-Za-zÀ-ÿ])',
);

final _snakeCode = RegExp(r'^[a-z][a-z0-9]*(_[a-z0-9]+)+$');
final _isoDate = RegExp(r'^\d{4}-\d{2}-\d{2}(T|$)');
final _rawDecimal = RegExp(r'^-?\d{4,}(\.\d+)?$');
final _uuid = RegExp(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');

/// Libellés d'actions jamais déclenchées (ouverture d'applications externes, fichiers, déconnexion).
final _skipActions = RegExp(
  r'(PDF|Reçu|Pièce|Preuve de signature|Télécharger|Exporter|Partager|Appeler|WhatsApp|Ouvrir sur le site|'
  r'^Ouvrir$|Se déconnecter|Déconnexion|Itinéraire|Visio|Rejoindre|Démarrer l.appel|Scanner|Prendre une photo|Caméra|Enregistrer un)',
  caseSensitive: false,
);

/// Icônes des boutons qui téléchargent ou ouvrent un fichier / une application externe.
final _fileIcons = <IconData>{
  Icons.picture_as_pdf_outlined,
  Icons.picture_as_pdf,
  Icons.download_outlined,
  Icons.download,
  Icons.file_download_outlined,
  Icons.file_download,
  Icons.open_in_new,
  Icons.open_in_browser,
  Icons.share_outlined,
  Icons.share,
  Icons.verified_outlined,
  Icons.workspace_premium_outlined,
  Icons.description_outlined,
  Icons.print_outlined,
};

class AppCrawler {
  AppCrawler(this.tester, {required this.app, required this.rootKey, String? shotsDir}) : shotsDir = shotsDir ?? 'build/parcours/$app';

  final WidgetTester tester;
  final String app;
  final GlobalKey rootKey;
  final String shotsDir;
  final findings = <Finding>[];
  final visited = <String>[];

  /// Limites de l'environnement de test (fonctions natives absentes : caméra, micro…), hors anomalies.
  final limits = <String>{};

  /// Listes vides : fiches et actions non vérifiées faute de données.
  final emptyLists = <String>[];
  final _errorsSeen = <String>{};
  int _shot = 0;
  String _current = 'démarrage';
  void Function(FlutterErrorDetails)? _previousOnError;

  // ------------------------------------------------------------------------------------------- erreurs Flutter
  void install() {
    final dir = Directory(shotsDir);
    if (dir.existsSync()) dir.deleteSync(recursive: true);
    dir.createSync(recursive: true);
    _previousOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      final first = details.exceptionAsString().split('\n').first;
      if (first.contains('MissingPluginException')) {
        limits.add('$_current : ${first.replaceAll(RegExp(r'^MissingPluginException\(|\)$'), '')}');
        return;
      }
      if (first.contains('A RenderFlex overflowed') || first.contains('overflowed by')) {
        _add('débordement', first);
      } else if (_errorsSeen.add(first)) {
        _add('exception', first);
      }
    };
  }

  void uninstall() => FlutterError.onError = _previousOnError;

  void _add(String kind, String detail) {
    final key = '$_current|$kind|$detail';
    if (findings.any((f) => '${f.screen}|${f.kind}|${f.detail}' == key)) return;
    findings.add(Finding(_current, kind, detail));
  }

  // ------------------------------------------------------------------------------------------- attentes
  bool get _busy => find
      .byWidgetPredicate(
        (w) => (w is CircularProgressIndicator && w.value == null) || (w is LinearProgressIndicator && w.value == null) || w is RefreshProgressIndicator,
      )
      .evaluate()
      .isNotEmpty;

  /// Attend la fin des chargements (indicateurs indéterminés absents trois relevés de suite).
  Future<void> settle({int maxSeconds = 25}) async {
    var quiet = 0;
    for (var i = 0; i < maxSeconds * 5; i++) {
      await tester.pump(const Duration(milliseconds: 200));
      quiet = _busy ? 0 : quiet + 1;
      if (quiet >= 3) return;
    }
    final spinner = find
        .byWidgetPredicate((w) => (w is CircularProgressIndicator && w.value == null) || (w is LinearProgressIndicator && w.value == null))
        .evaluate()
        .firstOrNull;
    final owners = <String>[];
    spinner?.visitAncestorElements((a) {
      final name = a.widget.runtimeType.toString();
      if (!name.startsWith('_') && owners.length < 4 && !const ['Center', 'Padding', 'SizedBox', 'Align'].contains(name)) owners.add(name);
      return owners.length < 4;
    });
    _add('lenteur', 'chargement toujours en cours après $maxSeconds s (${owners.join(' < ')})');
  }

  Future<void> waitFor(Finder finder, {int seconds = 60}) async {
    for (var i = 0; i < seconds * 5; i++) {
      await tester.pump(const Duration(milliseconds: 200));
      if (finder.evaluate().isNotEmpty) return;
    }
    throw TestFailure('Non affiché après $seconds s : $finder');
  }

  // ------------------------------------------------------------------------------------------- captures
  Future<void> shot(String name) async {
    final boundary = rootKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return;
    _shot++;
    final file = '$shotsDir/${_shot.toString().padLeft(3, '0')}-${_slug(name)}.png';
    await tester.runAsync(() async {
      try {
        final image = await boundary.toImage(pixelRatio: 1);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        if (bytes != null) File(file).writeAsBytesSync(bytes.buffer.asUint8List());
      } catch (_) {
        // Capture impossible (couche en cours de peinture) : le parcours continue.
      }
    });
  }

  static String _slug(String s) {
    final slug = s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9à-ÿ]+'), '-').replaceAll(RegExp(r'-+'), '-');
    return slug.length > 70 ? slug.substring(0, 70) : slug;
  }

  // ------------------------------------------------------------------------------------------- analyse d'écran
  Iterable<String> _texts() sync* {
    for (final e in find.byType(Text).evaluate()) {
      final w = e.widget as Text;
      final t = w.data ?? w.textSpan?.toPlainText();
      if (t != null && t.trim().isNotEmpty) yield t.trim();
    }
  }

  bool _insideEditable(Element e) {
    var inside = false;
    e.visitAncestorElements((a) {
      if (a.widget is EditableText || a.widget is TextField) {
        inside = true;
        return false;
      }
      return true;
    });
    return inside;
  }

  /// Relève les anomalies visibles de l'écran courant.
  void scan(String screen) {
    _current = screen;
    for (final t in _texts()) {
      for (final e in _errorTexts) {
        if (t.contains(e)) _add('erreur', t.length > 160 ? '${t.substring(0, 160)}…' : t);
      }
      if (_technical.hasMatch(t)) _add('technique', t.length > 160 ? '${t.substring(0, 160)}…' : t);
      if (_uuid.hasMatch(t)) _add('identifiant', t);
    }
    // Fiches : libellés et valeurs.
    for (final e in find.byType(InfoRow).evaluate()) {
      final row = e.widget as InfoRow;
      _checkLabel(row.label);
      final v = row.value?.trim() ?? '';
      if (row.valueWidget == null && v.isNotEmpty) _checkValue(row.label, v);
    }
    // Formulaires : libellés des champs.
    for (final e in find.byType(InputDecorator).evaluate()) {
      final label = (e.widget as InputDecorator).decoration.labelText;
      if (label != null) _checkLabel(label);
    }
    // Pastilles de statut : libellé français attendu.
    for (final e in find.byType(StatusBadge).evaluate()) {
      for (final t in find.descendant(of: find.byWidget(e.widget), matching: find.byType(Text)).evaluate()) {
        final text = ((t.widget as Text).data ?? '').trim();
        if (RegExp(r'^[a-z][a-z_ ]*$').hasMatch(text)) _add('statut non traduit', text);
      }
    }
    // Pastilles, puces et textes isolés : codes bruts.
    for (final e in find.byType(Text).evaluate()) {
      if (_insideEditable(e)) continue;
      final w = e.widget as Text;
      final t = (w.data ?? '').trim();
      if (t.isEmpty) continue;
      if (_snakeCode.hasMatch(t)) _add('code brut', t);
      if (_isoDate.hasMatch(t)) _add('date brute', t);
    }
  }

  void _checkLabel(String label) {
    final l = label.replaceAll('*', '').trim();
    if (l.isEmpty) return;
    if (l.contains('_')) {
      _add('libellé technique', l);
    } else if (_englishWord.hasMatch(l)) {
      _add('libellé anglais', l);
    } else if (RegExp(r'^[a-z]').hasMatch(l)) {
      _add('libellé non mis en forme', l);
    }
  }

  void _checkValue(String label, String v) {
    if (_snakeCode.hasMatch(v)) {
      _add('valeur brute', '$label = $v');
    } else if (_isoDate.hasMatch(v)) {
      _add('date brute', '$label = $v');
    } else if (_rawDecimal.hasMatch(v)) {
      _add('nombre non formaté', '$label = $v');
    } else if (RegExp(r'^[a-z]{3,}$').hasMatch(v) && optionLabel(v) != v) {
      _add('valeur non traduite', '$label = $v → ${optionLabel(v)}');
    } else if (v.startsWith('{') || v.startsWith('[')) {
      _add('valeur brute', '$label = ${v.length > 80 ? v.substring(0, 80) : v}');
    }
  }

  // ------------------------------------------------------------------------------------------- navigation
  BuildContext get _ctx => tester.element(find.byType(Scaffold).first);

  GoRouter get router => GoRouter.of(_ctx);

  Me? get me => Provider.of<AuthController>(_ctx, listen: false).user;

  /// Empreinte du premier plan : feuilles, boîtes de dialogue et titre de la barre visibles.
  String _signature() {
    final overlays = find.byType(BottomSheet).evaluate().length + find.byType(Dialog).evaluate().length;
    final bars = find.byType(AppBar).evaluate().toList();
    var title = '';
    if (bars.isNotEmpty) {
      final t = find.descendant(of: find.byWidget(bars.last.widget), matching: find.byType(Text)).evaluate();
      if (t.isNotEmpty) title = (t.first.widget as Text).data ?? '';
    }
    return '$overlays|${bars.length}|$title';
  }

  bool get _hasOverlay => find.byType(BottomSheet).evaluate().isNotEmpty || find.byType(Dialog).evaluate().isNotEmpty;

  bool get _hasBack => find.byType(BackButton).evaluate().isNotEmpty;

  /// Ferme la feuille, la boîte de dialogue ou la page poussée au premier plan (sans rien valider).
  Future<void> close() async {
    final cancel = find.descendant(of: find.byType(Dialog), matching: find.text('Annuler'));
    if (cancel.evaluate().isNotEmpty) {
      await tester.tap(cancel.last, warnIfMissed: false);
    } else if (find.byType(BottomSheet).evaluate().isNotEmpty) {
      Navigator.of(tester.element(find.byType(BottomSheet).last)).pop();
    } else if (find.byType(Dialog).evaluate().isNotEmpty) {
      Navigator.of(tester.element(find.byType(Dialog).last)).pop();
    } else if (_hasBack) {
      await tester.tap(find.byType(BackButton).last, warnIfMissed: false);
    } else {
      await Navigator.of(tester.element(find.byType(Scaffold).last)).maybePop();
    }
    await settle(maxSeconds: 10);
  }

  void _clearToasts() {
    for (final m in tester.stateList<ScaffoldMessengerState>(find.byType(ScaffoldMessenger))) {
      m.removeCurrentSnackBar();
      m.clearSnackBars();
    }
  }

  Future<void> _closeAll() async {
    for (var i = 0; i < 6 && (_hasOverlay || _hasBack); i++) {
      await close();
    }
  }

  /// Ouvre une rubrique par son chemin, l'analyse puis l'explore (création, première fiche, actions).
  Future<void> visit(String label, String path, {bool explore = true}) async {
    await _closeAll();
    _clearToasts();
    await tester.pump();
    _current = label;
    router.go(path);
    await settle();
    visited.add(label);
    scan(label);
    await shot(label);
    if (explore) await exploreScreen(label);
  }

  Future<void> exploreScreen(String screen) async {
    // Boutons de la page elle-même (pages sur mesure : finances, validations, documents…).
    if (find.byType(PagedListView).evaluate().isEmpty) await exploreActions(screen);
    // Formulaire de création (bouton flottant).
    final fab = find.byType(FloatingActionButton);
    if (fab.evaluate().isNotEmpty) {
      final label = _labelOf(fab.first) ?? 'Créer';
      if (!_skipActions.hasMatch(label)) await _openAndClose('$screen › $label', fab.first);
    }
    // Première fiche d'une liste de ressource.
    final tiles = find.descendant(of: find.byType(PagedListView), matching: find.byType(ListTile));
    if (tiles.evaluate().isEmpty && find.byType(PagedListView).evaluate().isNotEmpty) emptyLists.add(screen);
    if (tiles.evaluate().isNotEmpty) {
      final before = _signature();
      await tester.tap(tiles.first, warnIfMissed: false);
      await settle();
      final name = '$screen › fiche';
      scan(name);
      await shot(name);
      if (_signature() != before) {
        await exploreActions(name);
        await close();
      }
    }
  }

  String? _labelOf(Finder f) {
    final texts = find.descendant(of: f, matching: find.byType(Text)).evaluate();
    if (texts.isEmpty) return null;
    return (texts.first.widget as Text).data;
  }

  /// Ouvre chaque bouton d'action de la page (formulaires, confirmations), analyse, puis referme sans valider.
  Future<void> exploreActions(String screen) async {
    final scope = find.byType(PageList).evaluate().isNotEmpty ? find.byType(PageList).last : find.byType(Scaffold).last;
    final buttons = find.descendant(
      of: scope,
      matching: find.byWidgetPredicate((w) => w is FilledButton || w is OutlinedButton || w is ElevatedButton),
    );
    final labels = <String>[];
    for (final e in buttons.evaluate()) {
      final t = find.descendant(of: find.byWidget(e.widget), matching: find.byType(Text)).evaluate();
      if (t.isEmpty) continue;
      // Téléchargement / ouverture de fichier ou de lien externe : application native, jamais déclenché ici.
      final icons = find.descendant(of: find.byWidget(e.widget), matching: find.byType(Icon)).evaluate();
      if (icons.any((i) => _fileIcons.contains((i.widget as Icon).icon))) continue;
      final label = (t.first.widget as Text).data;
      if (label != null && !labels.contains(label) && !_skipActions.hasMatch(label)) labels.add(label);
    }
    for (final label in labels) {
      final target = find.descendant(of: scope, matching: find.text(label));
      if (target.evaluate().isEmpty) continue;
      await _openAndClose('$screen › $label', target.first);
    }
  }

  Future<void> _openAndClose(String name, Finder target) async {
    _clearToasts();
    await tester.pump();
    final before = _signature();
    try {
      await tester.ensureVisible(target);
      await tester.pump();
      await tester.tap(target, warnIfMissed: false);
    } catch (e) {
      _current = name;
      _add('interaction', 'bouton inaccessible : ${'$e'.split('\n').first}');
      return;
    }
    await settle();
    scan(name);
    await shot(name);
    if (_signature() != before) await close();
  }

  /// Rapport lisible (une ligne par anomalie, regroupé par type).
  String report() {
    final b = StringBuffer('=== Parcours $app : ${visited.length} rubriques, ${findings.length} anomalie(s) ===\n');
    final byKind = <String, List<Finding>>{};
    for (final f in findings) {
      byKind.putIfAbsent(f.kind, () => []).add(f);
    }
    for (final entry in byKind.entries) {
      b.writeln('--- ${entry.key} (${entry.value.length})');
      for (final f in entry.value) {
        b.writeln('  ${f.screen} : ${f.detail}');
      }
    }
    if (limits.isNotEmpty) b.writeln('--- limites du test sans appareil (fonctions natives, non vérifiées) : ${limits.join(' | ')}');
    if (emptyLists.isNotEmpty) b.writeln('--- couverture : listes vides, fiches non vérifiées (${emptyLists.length}) : ${emptyLists.join(', ')}');
    return b.toString();
  }
}

/// Rubriques du menu visibles pour l'utilisateur connecté (mêmes règles que le menu de l'application).
List<NavItem> visibleItems(List<NavSection> sections, Me? me) => [
  for (final s in sections)
    for (final i in s.items)
      if (i.visibleFor(me)) i,
];

/// Identifiant d'un chantier de l'API (code donné, sinon le premier) pour pré-sélectionner le chantier courant.
Future<String?> e2eProjectId(String apiUrl, GlobusApp app, String email, String password, {String? code, String path = '/projects'}) async {
  final dio = Dio(BaseOptions(baseUrl: '$apiUrl/api/v1', headers: {'X-Client-App': app.header}))..httpClientAdapter = CurlAdapter();
  final login = await dio.post<Map<String, dynamic>>('/auth/login', data: {'email': email, 'password': password});
  final token = login.data?['access_token'];
  if (token == null) return null;
  final res = await dio.get<Object?>(
    path,
    queryParameters: {'page_size': 50},
    options: Options(headers: {'Authorization': 'Bearer $token'}),
  );
  final data = res.data;
  final items = ((data is Map ? data['items'] : data) as List? ?? const []).cast<Map<String, dynamic>>();
  if (items.isEmpty) return null;
  return (items.where((p) => p['code'] == code).firstOrNull ?? items.first)['id'] as String?;
}

/// Services de l'application branchés sur une vraie API (requêtes synchrones curl, sans temps réel ni push).
GlobusServices e2eServices(GlobusApp app, String apiUrl) => GlobusServices.create(
  GlobusConfig(app: app, apiUrl: apiUrl, environment: 'development'),
  store: MemorySessionStore(),
  cache: MemoryCache(),
  dio: Dio()..httpClientAdapter = CurlAdapter(),
  liveFeatures: false,
);
