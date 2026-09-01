import 'package:flutter/material.dart';
import 'package:mobile_sacou/inicial.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Sacou',
      themeMode: ThemeMode.system,

      // MODO CLARO — espelha desktop :root
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF7F6FB),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF5F4C9A),
          brightness: Brightness.light,
          primary: const Color(0xFF6FB755),
          secondary: const Color(0xFF5F4C9A),
          surface: const Color(0xFFFFFFFF),
        ),

        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF7F6FB),
          foregroundColor: Color(0xFF1E1740),
          surfaceTintColor: Colors.transparent,
          scrolledUnderElevation: 0,
        ),

        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6FB755),
            foregroundColor: const Color(0xFF5F4C9A),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),

        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF5F4C9A),
            side: const BorderSide(color: Color(0xFF5F4C9A), width: 2),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),

        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF5F4C9A),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFECE8F5)),
          ),
        ),

        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF4F2FA),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFECE8F5)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFECE8F5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFF5F4C9A), width: 2),
          ),
          labelStyle: const TextStyle(color: Color(0xFF7C6FA0)),
          hintStyle: const TextStyle(color: Color(0xFF7C6FA0)),
        ),

        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFF1E1740)),
          bodyMedium: TextStyle(color: Color(0xFF1E1740)),
          bodySmall: TextStyle(color: Color(0xFF7C6FA0)),
          titleLarge: TextStyle(
              color: Color(0xFF1E1740), fontWeight: FontWeight.bold),
          titleMedium: TextStyle(
              color: Color(0xFF1E1740), fontWeight: FontWeight.w600),
        ),
      ),

      // MODO ESCURO — espelha desktop [data-theme="dark"]
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF13111E),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF8B7BBF),
          brightness: Brightness.dark,
          primary: const Color(0xFF6FB755),
          secondary: const Color(0xFF8B7BBF),
          surface: const Color(0xFF1E1A2E),
        ),

        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF13111E),
          foregroundColor: Color(0xFFEDE8FF),
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          scrolledUnderElevation: 0,
        ),

        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6FB755),
            foregroundColor: const Color(0xFF5F4C9A),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),

        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF8B7BBF),
            side: const BorderSide(color: Color(0xFF8B7BBF), width: 2),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),

        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF8B7BBF),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        cardTheme: CardThemeData(
          color: const Color(0xFF1E1A2E),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFF2A2440)),
          ),
        ),

        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF261F3A),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFF2A2440)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFF2A2440)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFF8B7BBF), width: 2),
          ),
          labelStyle: const TextStyle(color: Color(0xFF9080B8)),
          hintStyle: const TextStyle(color: Color(0xFF9080B8)),
        ),

        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFFEDE8FF)),
          bodyMedium: TextStyle(color: Color(0xFFEDE8FF)),
          bodySmall: TextStyle(color: Color(0xFF9080B8)),
          titleLarge: TextStyle(
              color: Color(0xFFEDE8FF), fontWeight: FontWeight.bold),
          titleMedium: TextStyle(
              color: Color(0xFFEDE8FF), fontWeight: FontWeight.w600),
        ),
      ),

      home: const Inicial(),
    );
  }
}
