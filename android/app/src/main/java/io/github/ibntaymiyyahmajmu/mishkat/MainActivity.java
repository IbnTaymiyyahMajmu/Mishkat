package io.github.ibntaymiyyahmajmu.mishkat;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

/**
 * The app is the site. Capacitor serves the static export from the app's own
 * files at https://localhost; what this app adds to it is in {@link Shell}.
 */
public class MainActivity extends BridgeActivity {

    /** However slow the page, the lamp gives way to it after this long. */
    private static final long SPLASH_AT_MOST = 2500;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The lamp stays until the first page is on the screen, rather than
        // giving way to an empty window while the page is being read.
        long start = SystemClock.uptimeMillis();
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(
            () -> !Pages.shown && SystemClock.uptimeMillis() - start < SPLASH_AT_MOST
        );
        // The window runs under the status bar and the gesture bar on every
        // version of Android, as Android 15 makes it, so the page is placed
        // between them the same way everywhere and the window shows behind
        // them — painted by Shell to match the page.
        EdgeToEdge.enable(this);
        // Before the bridge is made, so that it is in place for the first page.
        registerPlugin(Shell.class);
        super.onCreate(savedInstanceState);
        // After it, since the bridge sets its own while it is made; and still
        // within onCreate, which is the only time it may register what it needs.
        bridge.getWebView().setWebChromeClient(new FullScreen(bridge));
    }
}
