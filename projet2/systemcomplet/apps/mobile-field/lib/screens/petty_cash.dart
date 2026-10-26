import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

/// Rubriques de petite caisse (liste fermée côté serveur, ventilée dans les catégories du budget).
const _categories = ['materiaux', 'main_oeuvre', 'transport', 'restauration', 'carburant', 'petit_outillage', 'autre'];

/// Ma petite caisse : le gestionnaire déclare ses dépenses et réapprovisionnements avec le reçu ; la finance valide.
class PettyCashScreen extends StatelessWidget {
  const PettyCashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/petty-cash/me',
      builder: (context, data, handle) {
        final funds = listOf(data);
        if (funds.isEmpty) {
          return const EmptyView(
            icon: Icons.account_balance_wallet_outlined,
            title: 'Aucune caisse à votre nom',
            text: 'La finance vous désigne comme gestionnaire à la création d\'une petite caisse.',
          );
        }
        return PageList(
          children: [
            const PageHeader(title: 'Ma petite caisse', subtitle: 'Déclarez vos mouvements avec le reçu : la finance les valide.'),
            for (final f in funds) _FundCard(fund: f, onChanged: handle.reload),
          ],
        );
      },
    );
  }
}

class _FundCard extends StatelessWidget {
  const _FundCard({required this.fund, required this.onChanged});
  final J fund;
  final Future<void> Function() onChanged;

  Future<void> _declare(BuildContext context) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MovementSheet(fund: fund),
    );
    if (ok == true) await onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: fund.s('name'),
      subtitle: 'Solde ${money(fund['balance'])} · plafond ${money(fund['ceiling'])}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton.icon(onPressed: () => _declare(context), icon: const Icon(Icons.add), label: const Text('Déclarer un mouvement')),
          const SizedBox(height: 8),
          ApiView(
            path: '/petty-cash-funds/${fund.s('id')}/transactions',
            query: const {'page_size': 50},
            refreshable: false,
            builder: (context, data, _) {
              final items = J.of(data).list('items');
              if (items.isEmpty) return const Padding(padding: EdgeInsets.all(8), child: Text('Aucun mouvement.'));
              return Column(
                children: [
                  for (final t in items)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(t.s('purpose')),
                      subtitle: Text('${date(t['transaction_date'])} · ${optionLabel(t.s('category'))}'),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('${t.s('kind') == 'out' ? '−' : '+'}${money(t['amount'])}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          StatusBadge(t.s('status')),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MovementSheet extends StatefulWidget {
  const _MovementSheet({required this.fund});
  final J fund;
  @override
  State<_MovementSheet> createState() => _MovementSheetState();
}

class _MovementSheetState extends State<_MovementSheet> {
  String _kind = 'out';
  String _category = 'carburant';
  final _amount = TextEditingController();
  final _purpose = TextEditingController();
  List<UploadFile> _receipt = const [];
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _purpose.dispose();
    super.dispose();
  }

  bool get _valid =>
      (double.tryParse(_amount.text.replaceAll(',', '.').replaceAll(' ', '')) ?? 0) > 0 &&
      _purpose.text.trim().isNotEmpty &&
      (_kind == 'in' || _receipt.isNotEmpty);

  Future<void> _pick() async {
    final files = await pickAttachments(context, imagesOnly: false, multiple: false, field: 'receipt');
    if (files.isNotEmpty) setState(() => _receipt = files);
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    final res = await runAction(
      context,
      () => context.api.upload(
        '/petty-cash-funds/${widget.fund.s('id')}/transactions',
        files: _receipt,
        fields: {
          'kind': _kind,
          'amount': _amount.text.replaceAll(',', '.').replaceAll(' ', ''),
          'purpose': _purpose.text.trim(),
          'category': _category,
          'transaction_date': isoDate(DateTime.now()),
        },
      ),
      success: 'Mouvement déclaré : en attente de validation',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (res != null) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          children: [
            Text('Mouvement de caisse', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Type *'),
              items: const [
                DropdownMenuItem(value: 'out', child: Text('Sortie (dépense)')),
                DropdownMenuItem(value: 'in', child: Text('Entrée (réapprovisionnement)')),
              ],
              onChanged: (v) => setState(() => _kind = v ?? 'out'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Montant (FCFA) *'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _purpose,
              decoration: const InputDecoration(labelText: 'Objet *'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _category,
              decoration: const InputDecoration(labelText: 'Catégorie'),
              items: [for (final c in _categories) DropdownMenuItem(value: c, child: Text(optionLabel(c)))],
              onChanged: (v) => setState(() => _category = v ?? 'autre'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pick,
              icon: const Icon(Icons.receipt_long_outlined),
              label: Text(_receipt.isEmpty ? (_kind == 'out' ? 'Reçu * (photo du ticket ou facture)' : 'Reçu (facultatif)') : _receipt.first.name),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _valid && !_busy ? _submit : null, child: Text(_busy ? 'Envoi…' : 'Déclarer')),
          ],
        ),
      ),
    );
  }
}
