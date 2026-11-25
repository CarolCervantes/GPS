plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "co.diamon.salud.gps"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "co.diamon.salud.gps"
        minSdk = 24
        targetSdk = 37
        versionCode = 5
        versionName = "1.3.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.activity.ktx)
    implementation(libs.appcompat)
    implementation(libs.constraintlayout)
    implementation(libs.material)
}
