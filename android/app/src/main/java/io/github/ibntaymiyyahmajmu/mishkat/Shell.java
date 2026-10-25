package io.github.ibntaymiyyahmajmu.mishkat;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;

/**
 * What the app adds to the site it carries.
 *
 * <p>The pages. Every page of the export is a folder with an index.html in
 * it, and {@link Pages} answers each address with its own page rather than
 * with the home page, which is what Capacitor, made for single-page apps,
 * would otherwise send.
 *
 * <p>The bars. The page runs to the edges of the screen, under the status bar
 * and the gesture bar, and keeps its words clear of them itself (the site's
 * viewport, built with NEXT_PUBLIC_EDGE_TO_EDGE) — so the lamp's light reaches
 * the top of the glass. What is left to the app is the colour of the bars'
 * icons: light over a dark page, dark over a light one. The page says which
 * ({@link Pages#WATCH}), from the colour of its own ink at each edge, whenever
 * something has changed there; nothing here watches the screen. The colours it
 * names are also laid behind the page, for the moment before it is drawn and
 * for a WebView too old to draw under the bars, and kept, so the app opens
 * with them.
 *
 * <p>The recitation, which goes on when the app is out of sight, with its
 * notification and the lock screen's controls: {@link Recitation}.
 *
 * <p>Back, which puts down an open sheet before it goes back a page. And the
 * splash screen, which on Android 13 and later opens on the light the reader
 * last chose.
 */
@CapacitorPlugin(name = "Shell")
public class Shell extends Plugin {

    private static final String PREFERENCES = "shell";
    private static final String TOP = "top";
    private static final String BOTTOM = "bottom";
    private static final String TOP_DARK = "topDark";
    private static final String BOTTOM_DARK = "bottomDark";
    private static final String LIGHT = "light";

    /** Before the page has said anything: the landing page's ground in evening, the site's own default light (res/values/colors.xml). */
    private static final int EMBERS = 0xFF261C0F;

    private final Bands bands = new Bands();

    private Recitation recitation;
    private int top;
    private int bottom;
    private boolean topDark;
    private boolean bottomDark;
    private String light;

    /**
     * Asks the page to put down the sheet in front, if one is open — the
     * search, the menu, the study panel (the site's lib/back.ts) — and
     * answers whether it did. A page that does not know the question, or is
     * not yet there to be asked, answers no.
     */
    private static final String CLOSE_FRONT =
        "(function () { try { return !!(window.__mishkatBack && window.__mishkatBack()); } catch (e) { return false; } })()";

    /**
     * Back puts down whatever sheet is open over the page first, as it does
     * in any Android app; with none, it goes back a page, as a browser's
     * does; and from the first page it leaves the app, as Android's does.
     */
    private final OnBackPressedCallback back = new OnBackPressedCallback(true) {
        @Override
        public void handleOnBackPressed() {
            WebView web = bridge.getWebView();
            web.evaluateJavascript(CLOSE_FRONT, (closed) -> {
                if ("true".equals(closed)) return;
                if (web.canGoBack()) {
                    web.goBack();
                    return;
                }
                setEnabled(false);
                getActivity().getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            });
        }
    };

    @Override
    public void load() {
        SharedPreferences saved = preferences();
        top = saved.getInt(TOP, EMBERS);
        bottom = saved.getInt(BOTTOM, EMBERS);
        topDark = saved.getBoolean(TOP_DARK, true);
        bottomDark = saved.getBoolean(BOTTOM_DARK, true);
        light = saved.getString(LIGHT, "evening");

        WebView web = bridge.getWebView();
        recitation = new Recitation(bridge);
        bridge.setWebViewClient(new Pages(bridge, this));
        web.addJavascriptInterface(new Page(), "MishkatApp");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, Recitation.SHIM, Set.of("https://" + bridge.getHost()));
        }
        // A recitation goes on behind other apps only if the page playing it does.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), back);
        // Posted, so that it lands after SystemBars has set the bars to the
        // device's theme while it loaded.
        bridge.executeOnMainThread(this::paint);
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        recitation.close();
    }

    Recitation recitation() {
        return recitation;
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // SystemBars puts the bars back to the device's theme on every
        // configuration change — a rotation, the device going dark. Paint
        // over it once it has.
        bridge.executeOnMainThread(this::paint);
    }

    private void paint() {
        Window window = getActivity().getWindow();
        if (window.getDecorView().getBackground() != bands) window.getDecorView().setBackground(bands);
        bands.invalidateSelf();
        bridge.getWebView().setBackgroundColor(top);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        bars.setAppearanceLightStatusBars(!topDark);
        bars.setAppearanceLightNavigationBars(!bottomDark);
    }

    private void setEdges(int newTop, boolean newTopDark, int newBottom, boolean newBottomDark) {
        if (newTop == top && newTopDark == topDark && newBottom == bottom && newBottomDark == bottomDark) return;
        top = newTop;
        topDark = newTopDark;
        bottom = newBottom;
        bottomDark = newBottomDark;
        preferences()
            .edit()
            .putInt(TOP, top)
            .putBoolean(TOP_DARK, topDark)
            .putInt(BOTTOM, bottom)
            .putBoolean(BOTTOM_DARK, bottomDark)
            .apply();
        paint();
    }

    private void setLight(String name) {
        if (name.equals(light)) return;
        light = name;
        preferences().edit().putString(LIGHT, name).apply();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            int splash = switch (name) {
                case "day" -> R.style.AppTheme_NoActionBarLaunch_Day;
                case "night" -> R.style.AppTheme_NoActionBarLaunch_Night;
                default -> R.style.AppTheme_NoActionBarLaunch;
            };
            getActivity().getSplashScreen().setSplashScreenTheme(splash);
        }
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    /** What the page calls: through {@link Pages#WATCH}, and through {@link Recitation#SHIM}. */
    private final class Page {

        @JavascriptInterface
        public void nowPlaying(String title, String artist, String album, String artwork) {
            recitation.nowPlaying(title, artist, album, artwork);
        }

        @JavascriptInterface
        public void playbackState(String state) {
            recitation.playbackState(state);
        }

        @JavascriptInterface
        public void actions(String names) {
            recitation.actions(names);
        }

        @JavascriptInterface
        public void position(double duration, double position, double rate) {
            recitation.position(duration, position, rate);
        }

        /** The reader has changed the light, or the page has just said which it is. */
        @JavascriptInterface
        public void light(String name) {
            bridge.executeOnMainThread(() -> setLight(name));
        }

        /**
         * What the page shows at its top and bottom edges: the colour of the
         * ground there, as 0xRRGGBB, and whether it is dark.
         */
        @JavascriptInterface
        public void edges(int topGround, boolean topIsDark, int bottomGround, boolean bottomIsDark) {
            bridge.executeOnMainThread(() -> setEdges(0xFF000000 | topGround, topIsDark, 0xFF000000 | bottomGround, bottomIsDark));
        }
    }

    /**
     * The window's background: the top edge's ground above the middle and the
     * bottom edge's below it. Seen only before the page is drawn, or where a
     * WebView too old to draw under the bars leaves strips for them.
     */
    private final class Bands extends Drawable {

        private final Paint paint = new Paint();

        @Override
        public void draw(Canvas canvas) {
            Rect bounds = getBounds();
            paint.setColor(top);
            canvas.drawRect(bounds.left, bounds.top, bounds.right, bounds.centerY(), paint);
            paint.setColor(bottom);
            canvas.drawRect(bounds.left, bounds.centerY(), bounds.right, bounds.bottom, paint);
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(ColorFilter filter) {}

        @Override
        @SuppressWarnings("deprecation")
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }
}
