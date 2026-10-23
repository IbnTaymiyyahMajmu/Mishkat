package io.github.ibntaymiyyahmajmu.mishkat;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Full screen, for a page that asks for it — the film's own button.
 *
 * <p>A WebView shows an element full screen only if the app gives it somewhere
 * to: it hands over a view of the element and expects the app to fill the
 * screen with it. Capacitor's own handler declines at once, so in the app the
 * film's full-screen button did nothing. This lays the view over everything,
 * hides the status bar and the gesture bar until a swipe from the edge brings
 * them back for a moment, and takes it all away again when the page leaves
 * full screen — or when the reader presses Back, which leaves full screen
 * before it leaves the page.
 */
final class FullScreen extends BridgeWebChromeClient {

    private final Activity activity;
    private View shown;
    private CustomViewCallback whenLeft;

    private final OnBackPressedCallback back = new OnBackPressedCallback(false) {
        @Override
        public void handleOnBackPressed() {
            leave();
        }
    };

    FullScreen(Bridge bridge) {
        super(bridge);
        activity = bridge.getActivity();
        if (activity instanceof ComponentActivity component) {
            component.getOnBackPressedDispatcher().addCallback(component, back);
        }
    }

    @Override
    public void onShowCustomView(View view, CustomViewCallback callback) {
        if (shown != null) {
            callback.onCustomViewHidden();
            return;
        }
        shown = view;
        whenLeft = callback;
        ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
        decor.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(activity.getWindow(), decor);
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
        back.setEnabled(true);
    }

    @Override
    public void onHideCustomView() {
        if (shown == null) return;
        ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
        decor.removeView(shown);
        shown = null;
        back.setEnabled(false);
        WindowCompat.getInsetsController(activity.getWindow(), decor).show(WindowInsetsCompat.Type.systemBars());
        CustomViewCallback callback = whenLeft;
        whenLeft = null;
        if (callback != null) callback.onCustomViewHidden();
    }

    /** Leaves full screen from the app's side: the page hears of it as if it had left itself. */
    private void leave() {
        onHideCustomView();
    }
}
