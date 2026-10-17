import 'package:flutter/material.dart';

import '../format/labels.dart';
import '../generated/tokens.g.dart';

export '../generated/tokens.g.dart';

/// Familles de polices de la charte (§3), embarquées dans le paquet globus_core.
abstract final class GlobusFonts {
  static const body = 'packages/globus_core/Poppins';
  static const title = 'packages/globus_core/Gilroy';
  static const accent = 'packages/globus_core/Doxent';
}

/// Couleurs sémantiques dérivées des jetons (aucune couleur métier codée dans les écrans).
abstract final class GlobusColors {
  static const primary = GlobusTokens.brand500;
  static const accent = GlobusTokens.accent500;
  static const background = GlobusTokens.surface;
  static const ink = GlobusTokens.ink;
  static const muted = GlobusTokens.muted;
  static const line = GlobusTokens.line;
  static const success = GlobusTokens.success;
  static const warning = GlobusTokens.warning;
  static const danger = GlobusTokens.danger;
  static const night = GlobusTokens.brand900;

  static Color tone(Tone tone) => switch (tone) {
    Tone.success => success,
    Tone.danger => danger,
    Tone.warning => warning,
    Tone.info => primary,
    Tone.accent => accent,
    Tone.neutral => muted,
  };

  /// Fond doux associé à un ton (badges, alertes).
  static Color toneSoft(Tone t, {bool dark = false}) => tone(t).withValues(alpha: dark ? 0.22 : 0.10);
}

abstract final class GlobusTheme {
  static const radius = 16.0;

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme(
      brightness: brightness,
      primary: dark ? GlobusTokens.brand300 : GlobusTokens.brand500,
      onPrimary: dark ? GlobusTokens.brand900 : Colors.white,
      primaryContainer: dark ? GlobusTokens.brand700 : GlobusTokens.brand50,
      onPrimaryContainer: dark ? GlobusTokens.brand50 : GlobusTokens.brand800,
      secondary: GlobusTokens.accent500,
      onSecondary: Colors.white,
      secondaryContainer: dark ? GlobusTokens.accent700 : GlobusTokens.accent50,
      onSecondaryContainer: dark ? GlobusTokens.accent50 : GlobusTokens.accent700,
      tertiary: GlobusTokens.brand400,
      onTertiary: Colors.white,
      error: GlobusTokens.danger,
      onError: Colors.white,
      surface: dark ? const Color(0xFF111A30) : Colors.white,
      onSurface: dark ? const Color(0xFFE8ECF5) : GlobusTokens.ink,
      onSurfaceVariant: dark ? const Color(0xFFA9B2C6) : GlobusTokens.muted,
      surfaceContainerLowest: dark ? const Color(0xFF0B1224) : Colors.white,
      surfaceContainerLow: dark ? const Color(0xFF111A30) : const Color(0xFFFAFAFA),
      surfaceContainer: dark ? const Color(0xFF16213B) : GlobusTokens.surface,
      surfaceContainerHigh: dark ? const Color(0xFF1C2946) : const Color(0xFFEDEFF3),
      surfaceContainerHighest: dark ? const Color(0xFF23314F) : const Color(0xFFE6E9EF),
      outline: dark ? const Color(0xFF34425F) : GlobusTokens.line,
      outlineVariant: dark ? const Color(0xFF283553) : GlobusTokens.line,
      shadow: GlobusTokens.brand900,
      inverseSurface: dark ? GlobusTokens.brand50 : GlobusTokens.brand900,
      onInverseSurface: dark ? GlobusTokens.brand900 : Colors.white,
    );
    final base = ThemeData(useMaterial3: true, brightness: brightness, colorScheme: scheme, fontFamily: GlobusFonts.body);
    final text = base.textTheme.apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
    TextStyle? title(TextStyle? s, double size, [FontWeight w = FontWeight.w700]) =>
        s?.copyWith(fontFamily: GlobusFonts.title, fontSize: size, fontWeight: w, letterSpacing: -0.2, color: dark ? Colors.white : GlobusTokens.brand800);
    return base.copyWith(
      scaffoldBackgroundColor: dark ? const Color(0xFF0B1224) : GlobusTokens.surface,
      textTheme: text.copyWith(
        displaySmall: title(text.displaySmall, 34),
        headlineMedium: title(text.headlineMedium, 28),
        headlineSmall: title(text.headlineSmall, 24),
        titleLarge: title(text.titleLarge, 20),
        titleMedium: title(text.titleMedium, 16, FontWeight.w600),
        titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
        bodyMedium: text.bodyMedium?.copyWith(fontSize: 14, height: 1.45),
        bodySmall: text.bodySmall?.copyWith(fontSize: 12.5, color: scheme.onSurfaceVariant, height: 1.4),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? const Color(0xFF0B1224) : Colors.white,
        foregroundColor: dark ? Colors.white : GlobusTokens.brand800,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: GlobusFonts.title, fontSize: 19, fontWeight: FontWeight.w700, color: dark ? Colors.white : GlobusTokens.brand800),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontFamily: GlobusFonts.body, fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          side: BorderSide(color: scheme.outline),
          textStyle: const TextStyle(fontFamily: GlobusFonts.body, fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(44, 44),
          textStyle: const TextStyle(fontFamily: GlobusFonts.body, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? const Color(0xFF16213B) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: GlobusTokens.accent500, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: GlobusTokens.danger),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        side: BorderSide(color: scheme.outline),
        labelStyle: TextStyle(fontFamily: GlobusFonts.body, fontSize: 13, color: scheme.onSurface),
      ),
      dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1, thickness: 1),
      listTileTheme: ListTileThemeData(iconColor: scheme.primary, contentPadding: const EdgeInsets.symmetric(horizontal: 16)),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: dark ? const Color(0xFF0B1224) : Colors.white,
        indicatorColor: dark ? GlobusTokens.brand700 : GlobusTokens.brand50,
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStatePropertyAll(TextStyle(fontFamily: GlobusFonts.body, fontSize: 11.5, fontWeight: FontWeight.w500, color: scheme.onSurface)),
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: GlobusTokens.accent500),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
    );
  }
}
