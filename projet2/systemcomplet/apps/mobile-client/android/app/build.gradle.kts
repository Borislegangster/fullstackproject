import java.io.FileInputStream
import java.net.URI
import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Paramètres passés à la construction (--dart-define / --dart-define-from-file) : l'hôte du serveur GLOBUS sert aux
// liens d'application (e-mails, WhatsApp) ouverts directement dans l'application.
val dartDefines: Map<String, String> = (project.findProperty("dart-defines") as String?)
    ?.split(",")
    ?.mapNotNull { runCatching { String(Base64.getDecoder().decode(it)) }.getOrNull() }
    ?.mapNotNull { entry -> entry.split("=", limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } }
    ?.toMap() ?: emptyMap()
val globusHost: String = dartDefines["GLOBUS_API_URL"]?.let { runCatching { URI(it).host }.getOrNull() } ?: "localhost"

// Signature de publication : android/key.properties (jamais versionné), sinon clé de débogage (tests internes).
val keystoreProperties = Properties()
val keystoreFile = rootProject.file("key.properties")
if (keystoreFile.exists()) keystoreProperties.load(FileInputStream(keystoreFile))

android {
    namespace = "com.globusengineering.globus_client"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        applicationId = "com.globusengineering.client"
        minSdk = maxOf(flutter.minSdkVersion, 24)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["globusHost"] = globusHost
    }

    signingConfigs {
        if (keystoreFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystoreFile.exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
