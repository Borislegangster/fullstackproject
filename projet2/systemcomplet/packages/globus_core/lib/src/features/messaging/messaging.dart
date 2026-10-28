import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../api/json.dart';
import '../../api/session_store.dart';
import '../../context.dart';
import '../../files/files.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../realtime/realtime.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/media.dart';
import '../../widgets/primitives.dart';
import '../../widgets/ref_picker.dart';
import '../../widgets/states.dart';
import '../calls/call_controller.dart';

/// Messagerie sécurisée temps réel (§13) : conversations directes, de groupe et de projet, pièces jointes,
/// réponses, modification (15 min), suppression, accusés de lecture, saisie en cours, recherche, appels.
/// Miroir de apps/web/src/components/comms/messaging.tsx.
class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key, this.projectId, this.openConversationId, this.canCall = true});
  final String? projectId;
  final String? openConversationId;
  final bool canCall;

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<J>? _conversations;
  Object? _error;
  String _filter = '';
  final _search = TextEditingController();
  List<J>? _results;
  final List<VoidCallback> _unsubs = [];
  bool _openedInitial = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    final rt = context.realtime;
    _unsubs
      ..add(rt.subscribe('message.new', _onMessage))
      ..add(
        rt.subscribe('conversation.updated', (d) {
          if (!(_conversations ?? []).any((c) => c.s('id') == d['conversation_id'])) unawaited(_load());
        }),
      );
  }

  @override
  void didUpdateWidget(ConversationsScreen old) {
    super.didUpdateWidget(old);
    if (old.projectId != widget.projectId) unawaited(_load());
  }

  @override
  void dispose() {
    for (final u in _unsubs) {
      u();
    }
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await context.api.fetch('/conversations', query: {'project_id': widget.projectId});
      if (!mounted) return;
      setState(() {
        _conversations = listOf(res.data);
        _error = null;
      });
      final initial = widget.openConversationId;
      if (initial != null && !_openedInitial) {
        _openedInitial = true;
        var conv = _conversations!.where((c) => c.s('id') == initial).firstOrNull;
        // Lien de notification vers une conversation hors de la liste (autre projet, groupe) : chargée directement.
        if (conv == null) {
          try {
            conv = J.of(await context.api.get('/conversations/$initial'));
          } catch (_) {
            conv = null;
          }
        }
        if (conv != null && mounted) unawaited(_open(conv));
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  void _onMessage(Map<String, dynamic> data) {
    final m = J(data);
    final me = context.auth.user?.id;
    final list = _conversations;
    if (list == null) return;
    // Conversation ouverte par un interlocuteur : elle apparaît aussitôt dans la liste.
    if (!list.any((c) => c.s('id') == m.s('conversation_id'))) {
      unawaited(_load());
      return;
    }
    setState(() {
      _conversations = [
        for (final c in list)
          if (c.s('id') == m.s('conversation_id'))
            J({
              ...c.raw,
              'last_message': {'body': m.str('body') ?? '📎', 'at': m.s('created_at'), 'sender_id': m.obj('sender').s('id'), 'kind': m.s('kind')},
              'last_message_at': m.s('created_at'),
              'unread': m.obj('sender').s('id') == me ? c.i('unread') : c.i('unread') + 1,
            })
          else
            c,
      ]..sort((a, b) => (b.str('last_message_at') ?? '').compareTo(a.str('last_message_at') ?? ''));
    });
  }

  Future<void> _open(J conv) async {
    setState(() {
      _conversations = [
        for (final c in _conversations ?? <J>[]) c.s('id') == conv.s('id') ? J({...c.raw, 'unread': 0}) : c,
      ];
    });
    await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(conversation: conv, canCall: widget.canCall),
      ),
    );
    if (mounted) unawaited(_load());
  }

  Future<void> _runSearch() async {
    final q = _search.text.trim();
    if (q.length < 2) {
      setState(() => _results = null);
      return;
    }
    final res = await runAction(context, () => context.api.get('/chat/search', query: {'q': q}));
    if (res != null && mounted) setState(() => _results = listOf(res));
  }

  @override
  Widget build(BuildContext context) {
    final me = context.auth.user;
    final rt = context.watch<Realtime>();
    final visible = (_conversations ?? []).where((c) => _filter.isEmpty || c.s('title').toLowerCase().contains(_filter.toLowerCase())).toList();
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'new-conversation',
        onPressed: () async {
          final conv = await showModalBottomSheet<J>(
            context: context,
            isScrollControlled: true,
            builder: (_) => FractionallySizedBox(heightFactor: 0.9, child: NewConversationSheet(projectId: widget.projectId)),
          );
          if (conv != null && mounted) {
            setState(() => _conversations = [conv, ...(_conversations ?? <J>[]).where((c) => c.s('id') != conv.s('id'))]);
            unawaited(_open(conv));
          }
        },
        icon: const Icon(Icons.add_comment_outlined),
        label: const Text('Nouvelle conversation'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.filter_list), hintText: 'Filtrer les conversations', isDense: true),
                  onChanged: (v) => setState(() => _filter = v),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _runSearch(),
                  decoration: InputDecoration(
                    hintText: 'Rechercher dans les messages',
                    isDense: true,
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(tooltip: 'Rechercher', icon: const Icon(Icons.arrow_forward), onPressed: _runSearch),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _results != null
                ? Column(
                    children: [
                      ListTile(
                        dense: true,
                        title: Text('${_results!.length} résultat(s)'),
                        trailing: TextButton(onPressed: () => setState(() => _results = null), child: const Text('Fermer')),
                      ),
                      Expanded(
                        child: ListView.separated(
                          itemCount: _results!.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final m = _results![i];
                            return ListTile(
                              title: Text(m.s('body'), maxLines: 2, overflow: TextOverflow.ellipsis),
                              subtitle: Text('${m.obj('sender').s('name')} · ${dateTime(m['created_at'])}'),
                              onTap: () {
                                final conv = (_conversations ?? []).where((c) => c.s('id') == m.s('conversation_id')).firstOrNull;
                                if (conv != null) unawaited(_open(conv));
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  )
                : _conversations == null
                ? (_error != null ? ErrorView(error: _error, onRetry: _load) : const LoadingView())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: visible.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 60),
                              EmptyView(
                                icon: Icons.forum_outlined,
                                title: 'Aucune conversation',
                                text: 'Échangez en toute sécurité avec votre équipe et vos interlocuteurs.',
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.only(bottom: 96),
                            itemCount: visible.length,
                            separatorBuilder: (_, _) => const Divider(height: 1, indent: 72),
                            itemBuilder: (context, i) {
                              final c = visible[i];
                              final members = c.list('members');
                              final peer = c.s('kind') == 'direct' ? members.where((m) => m.s('user_id') != me?.id).firstOrNull : null;
                              final online = peer != null && (rt.isOnline(peer.s('user_id')) || peer.b('online'));
                              final last = c.objOrNull('last_message');
                              return ListTile(
                                onTap: () => _open(c),
                                leading: c.s('kind') == 'direct'
                                    ? Avatar(name: c.s('title'), size: 44, online: online)
                                    : const CircleAvatar(
                                        radius: 22,
                                        backgroundColor: GlobusTokens.accent100,
                                        child: Icon(Icons.groups_outlined, color: GlobusTokens.accent700),
                                      ),
                                title: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        c.s('title'),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                    if (last != null) Text(relative(last['at']), style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11)),
                                  ],
                                ),
                                subtitle: Row(
                                  children: [
                                    Expanded(child: Text(last?.str('body') ?? 'Aucun message', maxLines: 1, overflow: TextOverflow.ellipsis)),
                                    if (c.i('unread') > 0)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                                        decoration: BoxDecoration(color: GlobusColors.accent, borderRadius: BorderRadius.circular(999)),
                                        child: Text(
                                          '${c.i('unread')}',
                                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                                        ),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Conversation : messages, envoi optimiste, pièces jointes, réponses, modification, suppression, appels.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.conversation, this.canCall = true});
  final J conversation;
  final bool canCall;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final List<J> _messages = [];
  bool _hasMore = false;
  bool _loading = true;
  Object? _error;
  final _text = TextEditingController();
  final _scroll = ScrollController();
  J? _replyTo;
  J? _editing;
  final List<J> _pending = [];
  bool _uploading = false;
  final Map<String, String> _typing = {};
  late List<J> _members = widget.conversation.list('members');
  Timer? _typingTimer;
  final List<VoidCallback> _unsubs = [];
  late final Realtime _rt = context.realtime;
  late final ApiClient _api = context.api;

  String get _id => widget.conversation.s('id');
  String? get _me => context.auth.user?.id;

  @override
  void initState() {
    super.initState();
    _rt.join('conversation:$_id');
    _unsubs
      ..add(_rt.subscribe('message.new', _onNew))
      ..add(
        _rt.subscribe('message.updated', (d) {
          final m = J(d);
          setState(() {
            for (var i = 0; i < _messages.length; i++) {
              if (_messages[i].s('id') == m.s('id')) _messages[i] = m;
            }
          });
        }),
      )
      ..add(_rt.subscribe('message.deleted', (d) => _markDeleted(d['id']?.toString())))
      ..add(
        _rt.subscribe('typing', (d) {
          if (d['conversation_id'] != _id || d['user_id'] == _me) return;
          setState(() {
            if (d['typing'] == true) {
              _typing[d['user_id'].toString()] = d['name']?.toString() ?? '';
            } else {
              _typing.remove(d['user_id'].toString());
            }
          });
        }),
      )
      ..add(
        _rt.subscribe('read', (d) {
          if (d['conversation_id'] != _id) return;
          setState(() {
            _members = [
              for (final m in _members) m.s('user_id') == d['user_id'] ? J({...m.raw, 'last_read_at': d['at']}) : m,
            ];
          });
        }),
      );
    unawaited(_load());
  }

  @override
  void dispose() {
    for (final u in _unsubs) {
      u();
    }
    _rt.leave('conversation:$_id');
    _typingTimer?.cancel();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = J.of(await _api.get('/conversations/$_id/messages', query: {'limit': 50}));
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(res.list('items'));
        _hasMore = res.b('has_more');
        _loading = false;
      });
      _markRead();
      _toBottom(jump: true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadOlder() async {
    if (_messages.isEmpty) return;
    final res = J.of(await _api.get('/conversations/$_id/messages', query: {'limit': 50, 'before': _messages.first.s('created_at')}));
    if (!mounted) return;
    setState(() {
      _messages.insertAll(0, res.list('items'));
      _hasMore = res.b('has_more');
    });
  }

  void _markRead() {
    final last = _messages.isEmpty ? null : _messages.last.s('id');
    if (!_rt.send('read', {'conversation_id': _id, 'message_id': last})) {
      unawaited(_api.post('/conversations/$_id/read', body: {'message_id': last}).catchError((Object _) => null));
    }
  }

  void _onNew(Map<String, dynamic> data) {
    final m = J(data);
    if (m.s('conversation_id') != _id) return;
    final cid = m.str('client_message_id');
    setState(() {
      final i = _messages.indexWhere((x) => x.s('id') == m.s('id') || (cid != null && x.str('client_message_id') == cid));
      if (i >= 0) {
        _messages[i] = m;
      } else {
        _messages.add(m);
      }
    });
    _toBottom();
    if (m.obj('sender').s('id') != _me) _markRead();
  }

  void _markDeleted(String? id) {
    setState(() {
      for (var i = 0; i < _messages.length; i++) {
        if (_messages[i].s('id') == id) {
          _messages[i] = J({..._messages[i].raw, 'body': null, 'deleted_at': DateTime.now().toUtc().toIso8601String(), 'attachments': <Object>[]});
        }
      }
    });
  }

  void _toBottom({bool jump = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      final max = _scroll.position.maxScrollExtent;
      if (jump) {
        _scroll.jumpTo(max);
      } else {
        unawaited(_scroll.animateTo(max, duration: const Duration(milliseconds: 250), curve: Curves.easeOut));
      }
    });
  }

  void _notifyTyping() {
    _rt.send('typing', {'conversation_id': _id, 'typing': true});
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(milliseconds: 2500), () => _rt.send('typing', {'conversation_id': _id, 'typing': false}));
  }

  Future<void> _attach() async {
    final files = await pickAttachments(context, allowVideo: true);
    if (files.isEmpty) return;
    setState(() => _uploading = true);
    try {
      for (final f in files.take(10 - _pending.length)) {
        final res = J.of(await _api.upload('/chat/files', files: [f]));
        // Chemin local gardé pour la vignette avant envoi (non transmis au serveur).
        setState(() => _pending.add(J({...res.raw, 'local_path': f.path})));
      }
    } catch (e) {
      if (mounted) context.toastError(e);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    final text = _text.text.trim();
    if (text.isEmpty && _pending.isEmpty) return;
    if (_editing != null) {
      final updated = await runAction(context, () => _api.patch('/messages/${_editing!.s('id')}', body: {'body': text}));
      if (updated != null && mounted) {
        final u = J.of(updated);
        setState(() {
          for (var i = 0; i < _messages.length; i++) {
            if (_messages[i].s('id') == u.s('id')) _messages[i] = u;
          }
          _editing = null;
          _text.clear();
        });
      }
      return;
    }
    final clientId = newKey();
    final kind = _pending.isEmpty ? 'text' : (_pending.every((p) => p.s('mime_type').startsWith('image/')) ? 'image' : 'file');
    final user = context.auth.user!;
    final optimistic = J({
      'id': clientId,
      'conversation_id': _id,
      'sender': {'id': user.id, 'name': user.fullName},
      'body': text.isEmpty ? null : text,
      'kind': kind,
      'reply_to_id': _replyTo?.s('id'),
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'client_message_id': clientId,
      'attachments': <Object>[],
    });
    final body = {
      'body': text.isEmpty ? null : text,
      'kind': kind,
      'reply_to_id': _replyTo?.s('id'),
      'attachments': [
        for (final p in _pending) {'file_id': p.s('file_id')},
      ],
      'client_message_id': clientId,
    };
    setState(() {
      _messages.add(optimistic);
      _text.clear();
      _pending.clear();
      _replyTo = null;
    });
    _rt.send('typing', {'conversation_id': _id, 'typing': false});
    _toBottom();
    try {
      final saved = J.of(await _api.post('/conversations/$_id/messages', body: body, idempotent: clientId));
      if (!mounted) return;
      setState(() {
        for (var i = 0; i < _messages.length; i++) {
          if (_messages[i].str('client_message_id') == clientId) _messages[i] = saved;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages.removeWhere((x) => x.str('client_message_id') == clientId);
        _text.text = text;
      });
      context.toast('Message non envoyé : ${errorMessage(e)}', error: true);
    }
  }

  Future<void> _actions(J m) async {
    final mine = m.obj('sender').s('id') == _me;
    final created = m.date('created_at');
    final editable = mine && created != null && DateTime.now().difference(created).inMinutes < 15;
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(leading: const Icon(Icons.reply), title: const Text('Répondre'), onTap: () => Navigator.pop(ctx, 'reply')),
            if (editable) ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('Modifier'), onTap: () => Navigator.pop(ctx, 'edit')),
            if (mine)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: GlobusColors.danger),
                title: const Text('Supprimer', style: TextStyle(color: GlobusColors.danger)),
                onTap: () => Navigator.pop(ctx, 'delete'),
              ),
          ],
        ),
      ),
    );
    if (!mounted) return;
    switch (action) {
      case 'reply':
        setState(() => _replyTo = m);
      case 'edit':
        setState(() {
          _editing = m;
          _text.text = m.s('body');
        });
      case 'delete':
        if (await confirmDialog(context, title: 'Supprimer ce message ?', danger: true, confirm: 'Supprimer') && mounted) {
          final ok = await runAction(context, () async {
            await _api.delete('/messages/${m.s('id')}');
            return true;
          });
          if (ok == true) _markDeleted(m.s('id'));
        }
    }
  }

  int _readers(J m) {
    final others = _members.where((o) => o.s('user_id') != _me);
    final at = m.s('created_at');
    return others.where((o) => o.has('last_read_at') && o.s('last_read_at').compareTo(at) >= 0).length;
  }

  @override
  Widget build(BuildContext context) {
    final rt = context.watch<Realtime>();
    final conv = widget.conversation;
    final others = _members.where((o) => o.s('user_id') != _me).toList();
    final subtitle = _typing.isNotEmpty
        ? '${_typing.values.join(', ')} écrit…'
        : others.map((o) => '${o.s('name')}${rt.isOnline(o.s('user_id')) ? ' ●' : ''}').join(', ');
    final calls = context.read<CallController?>();
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(conv.s('title'), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        actions: [
          if (widget.canCall && calls != null && others.isNotEmpty) ...[
            IconButton(
              tooltip: 'Appel audio',
              icon: const Icon(Icons.call_outlined),
              onPressed: () => calls.start(context, participantIds: [for (final o in others) o.s('user_id')], kind: CallKind.audio, conversationId: _id),
            ),
            IconButton(
              tooltip: 'Appel vidéo',
              icon: const Icon(Icons.videocam_outlined),
              onPressed: () => calls.start(context, participantIds: [for (final o in others) o.s('user_id')], kind: CallKind.video, conversationId: _id),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorView(error: _error, onRetry: _load)
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    itemCount: _messages.length + 1,
                    itemBuilder: (context, i) {
                      if (i == 0) {
                        return _hasMore
                            ? Center(
                                child: TextButton(onPressed: _loadOlder, child: const Text('Messages précédents')),
                              )
                            : (_messages.isEmpty
                                  ? const EmptyView(icon: Icons.chat_bubble_outline, title: 'Aucun message', text: 'Écrivez le premier message.')
                                  : const SizedBox.shrink());
                      }
                      final m = _messages[i - 1];
                      final parentId = m.str('reply_to_id');
                      final parent = parentId == null ? null : _messages.where((x) => x.s('id') == parentId).firstOrNull;
                      return _Bubble(
                        message: m,
                        mine: m.obj('sender').s('id') == _me,
                        showSender: conv.s('kind') != 'direct',
                        parent: parent,
                        readers: _readers(m),
                        onLongPress: m.has('deleted_at') ? null : () => _actions(m),
                      );
                    },
                  ),
          ),
          _composer(),
        ],
      ),
    );
  }

  Widget _composer() {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      elevation: 6,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_replyTo != null || _editing != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.fromLTRB(10, 4, 4, 4),
                  decoration: BoxDecoration(color: theme.colorScheme.primaryContainer, borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _editing != null ? 'Modification du message' : 'Réponse à ${_replyTo!.obj('sender').s('name')} : ${_replyTo!.s('body')}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Annuler',
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () => setState(() {
                          _replyTo = null;
                          if (_editing != null) _text.clear();
                          _editing = null;
                        }),
                      ),
                    ],
                  ),
                ),
              if (_pending.isNotEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      for (final p in _pending)
                        InputChip(
                          avatar: !kIsWeb && p.has('local_path') && p.s('mime_type').startsWith('image/')
                              ? CircleAvatar(backgroundImage: FileImage(File(p.s('local_path'))))
                              : Icon(_attachmentIcon(p.s('mime_type'), p.s('name')), size: 16),
                          label: Text('${p.s('name')} · ${fileSize(p['size_bytes'])}', overflow: TextOverflow.ellipsis),
                          onDeleted: () => setState(() => _pending.remove(p)),
                        ),
                    ],
                  ),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Joindre un fichier',
                    onPressed: _uploading || _editing != null ? null : _attach,
                    icon: _uploading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.attach_file),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _text,
                      minLines: 1,
                      maxLines: 5,
                      maxLength: 8000,
                      buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(hintText: 'Votre message…', isDense: true),
                      onChanged: (_) {
                        _notifyTyping();
                        setState(() {});
                      },
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton.filled(
                    tooltip: 'Envoyer',
                    onPressed: _text.text.trim().isEmpty && _pending.isEmpty ? null : _submit,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine, required this.showSender, this.parent, required this.readers, this.onLongPress});
  final J message;
  final bool mine;
  final bool showSender;
  final J? parent;
  final int readers;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final m = message;
    final deleted = m.has('deleted_at');
    final pendingSend = mine && m.has('client_message_id') && m.s('id') == m.s('client_message_id');
    final fg = mine ? Colors.white : theme.colorScheme.onSurface;
    final meta = mine ? GlobusTokens.brand100 : theme.colorScheme.onSurfaceVariant;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: onLongPress,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          decoration: BoxDecoration(
            color: mine ? GlobusTokens.brand500 : theme.colorScheme.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            ),
            border: mine ? null : Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!mine && showSender)
                Text(
                  m.obj('sender').s('name'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: GlobusTokens.accent600),
                ),
              if (parent != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 4, top: 2),
                  padding: const EdgeInsets.only(left: 8),
                  decoration: BoxDecoration(
                    border: Border(left: BorderSide(color: mine ? Colors.white54 : GlobusTokens.brand200, width: 2)),
                  ),
                  child: Text(
                    parent!.str('body') ?? 'Pièce jointe',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: meta),
                  ),
                ),
              if (deleted)
                Text(
                  'Message supprimé',
                  style: TextStyle(fontStyle: FontStyle.italic, color: fg.withValues(alpha: 0.7)),
                )
              else if (m.has('body'))
                Text(m.s('body'), style: TextStyle(color: fg)),
              for (final a in m.list('attachments')) _AttachmentView(attachment: a, mine: mine, fg: fg, meta: meta),
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (m.has('edited_at')) Text('modifié · ', style: TextStyle(fontSize: 10, color: meta)),
                  Text(time(m['created_at']), style: TextStyle(fontSize: 10, color: meta)),
                  if (pendingSend)
                    Text('  envoi…', style: TextStyle(fontSize: 10, color: meta))
                  else if (mine) ...[
                    const SizedBox(width: 3),
                    Icon(readers > 0 ? Icons.done_all : Icons.done, size: 13, color: meta),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final _mediaName = RegExp(r'\.(mp4|mov|m4v|webm|m4a|mp3|aac|ogg|oga|opus|wav)$', caseSensitive: false);

bool _isImage(String mime) => mime.startsWith('image/') && mime != 'image/svg+xml';
bool _isMedia(String mime, String name) => mime.startsWith('video/') || mime.startsWith('audio/') || _mediaName.hasMatch(name);

IconData _attachmentIcon(String mime, String name) {
  if (_isImage(mime)) return Icons.image_outlined;
  if (mime.startsWith('audio/')) return Icons.graphic_eq;
  if (_isMedia(mime, name)) return Icons.play_circle_outline;
  if (mime == 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return Icons.picture_as_pdf_outlined;
  return Icons.attach_file;
}

/// Pièce jointe d'un message : photo en vignette (plein écran avec zoom au toucher), vidéo et audio lus dans
/// l'application, autres fichiers (PDF, plans, tableurs) téléchargés puis ouverts avec l'application adaptée.
class _AttachmentView extends StatelessWidget {
  const _AttachmentView({required this.attachment, required this.mine, required this.fg, required this.meta});
  final J attachment;
  final bool mine;
  final Color fg;
  final Color meta;

  @override
  Widget build(BuildContext context) {
    final a = attachment;
    final path = '/chat/attachments/${a.s('id')}';
    final name = a.str('name') ?? 'Pièce jointe';
    final mime = a.s('mime_type');
    if (_isImage(mime)) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Semantics(
          button: true,
          label: 'Agrandir $name',
          child: GestureDetector(
            onTap: () => GalleryScreen.open(context, [GalleryItem(url: path, caption: name)]),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: AuthImage(path, width: 220, height: 160, semanticLabel: name),
            ),
          ),
        ),
      );
    }
    final media = _isMedia(mime, name);
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: InkWell(
        onTap: media
            ? () => GalleryScreen.open(context, [GalleryItem(url: path, caption: name, isVideo: true)])
            : () => openRemoteFile(context, path, filename: name),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: mine ? Colors.white.withValues(alpha: 0.15) : Theme.of(context).colorScheme.surfaceContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(_attachmentIcon(mime, name), size: 18, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(name, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: fg)),
              ),
              if (a.has('size_bytes')) Text('  ${fileSize(a['size_bytes'])}', style: TextStyle(fontSize: 11, color: meta)),
              const SizedBox(width: 4),
              Icon(media ? Icons.play_arrow : Icons.visibility_outlined, size: 16, color: meta),
            ],
          ),
        ),
      ),
    );
  }
}

const _channelKinds = [('project', 'Équipe du projet'), ('trade', 'Corps de métier'), ('client', 'Échanges avec le client')];

/// Nouvelle conversation : personnes (directe ou groupe) ou canal de projet (équipe interne uniquement).
class NewConversationSheet extends StatefulWidget {
  const NewConversationSheet({super.key, this.projectId});
  final String? projectId;
  @override
  State<NewConversationSheet> createState() => _NewConversationSheetState();
}

class _NewConversationSheetState extends State<NewConversationSheet> {
  bool _channel = false;
  J? _project;
  String _kind = 'project';
  String? _trade;
  final _q = TextEditingController();
  final _title = TextEditingController();
  List<J> _contacts = [];
  final Set<String> _selected = {};
  bool _busy = false;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    unawaited(_search());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    _title.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    try {
      final res = await context.api.get('/contacts', query: {'q': _q.text.trim()});
      if (mounted) setState(() => _contacts = listOf(res));
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    }
  }

  Future<void> _create() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = context.api;
      final dynamic conv;
      if (_channel) {
        conv = await api.post(
          '/conversations/project-channel',
          body: {
            'project_id': _project?.s('id') ?? widget.projectId,
            'trade': _kind == 'trade' ? _trade : null,
            'client_channel': _kind == 'client',
          },
        );
      } else if (_selected.length == 1 && _title.text.trim().isEmpty) {
        conv = await api.post('/conversations/direct', body: {'user_id': _selected.first});
      } else {
        conv = await api.post(
          '/conversations',
          body: {
            'title': _title.text.trim().isEmpty ? 'Groupe' : _title.text.trim(),
            'member_ids': _selected.toList(),
            'project_id': widget.projectId,
          },
        );
      }
      if (mounted) Navigator.pop(context, J.of(conv));
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final internal = context.auth.user?.organization?.str('kind') == 'internal';
    final canSubmit = _channel
        ? ((_project != null || widget.projectId != null) && (_kind != 'trade' || _trade != null))
        : _selected.isNotEmpty && (_selected.length == 1 || _title.text.trim().length >= 2);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Nouvelle conversation', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (internal)
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Personnes')),
                ButtonSegment(value: true, label: Text('Canal de projet')),
              ],
              selected: {_channel},
              onSelectionChanged: (s) => setState(() => _channel = s.first),
            ),
          const SizedBox(height: 10),
          if (_channel) ...[
            RefField(label: 'Projet', required: true, source: Refs.projects, value: _project, onChanged: (v) => setState(() => _project = v)),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Canal *'),
              items: [for (final k in _channelKinds) DropdownMenuItem(value: k.$1, child: Text(k.$2))],
              onChanged: (v) => setState(() => _kind = v ?? 'project'),
            ),
            if (_kind == 'trade') ...[
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _trade,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Corps de métier *'),
                items: [for (final t in personTradeOptions()) DropdownMenuItem(value: t.value, child: Text(t.label))],
                onChanged: (v) => setState(() => _trade = v),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              'Les membres du projet concernés sont ajoutés automatiquement ; un canal déjà ouvert est simplement rouvert.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const Spacer(),
          ] else ...[
            TextField(
              controller: _q,
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher une personne…', isDense: true),
              onChanged: (_) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 250), () => unawaited(_search()));
              },
            ),
            if (_selected.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: TextField(
                  controller: _title,
                  maxLength: 200,
                  decoration: const InputDecoration(labelText: 'Nom du groupe *'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            const SizedBox(height: 8),
            Expanded(
              child: _contacts.isEmpty
                  ? const EmptyView(title: 'Aucun contact joignable')
                  : ListView.builder(
                      itemCount: _contacts.length,
                      itemBuilder: (context, i) {
                        final c = _contacts[i];
                        final on = _selected.contains(c.s('id'));
                        return CheckboxListTile(
                          value: on,
                          onChanged: (_) => setState(() => on ? _selected.remove(c.s('id')) : _selected.add(c.s('id'))),
                          secondary: Avatar(name: c.s('name'), size: 36, online: c.b('online')),
                          title: Text(c.s('name')),
                          subtitle: Text([c.str('job_title'), c.str('organization')].whereType<String>().join(' · ')),
                        );
                      },
                    ),
            ),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          const SizedBox(height: 10),
          BusyButton(
            expand: true,
            busy: _busy,
            label: _channel ? 'Ouvrir le canal' : (_selected.length > 1 ? 'Créer le groupe' : 'Démarrer'),
            onPressed: canSubmit ? _create : null,
          ),
        ],
      ),
    );
  }
}
