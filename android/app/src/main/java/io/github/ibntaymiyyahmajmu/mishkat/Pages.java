package io.github.ibntaymiyyahmajmu.mishkat;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/**
 * Serves each page of the site as itself.
 *
 * <p>The export is a folder to a page — read/2/index.html — and the site
 * links to the folder, read/2/. Moving between pages, the site's own router
 * fetches what it needs and never asks for the folder; but a page opened by
 * its address — on a reload, or when the router hands a link back to the
 * browser — does. Capacitor answers any address without a file extension
 * with the home page, which would put the home page under another page's
 * address. This answers it with the folder's own index.html, or the site's
 * 404 page where there is none, and leaves everything else to Capacitor.
 */
final class Pages extends BridgeWebViewClient {

    /**
     * Tells the app what it needs to know of the page, and keeps telling it.
     *
     * The light, for the splash screen: the root element's data-theme, or
     * none for evening, the default.
     *
     * And the two edges, for the bars drawn over them: at the top and at the
     * foot of the screen, the colour of the ground and whether it is dark.
     * Dark is read from the ink — light ink is set on a dark ground, and ink
     * is always a flat colour where a ground may be a gradient. The ground is
     * the first solid colour behind the edge; a wide box painted with a
     * gradient is the lit niche, and gives its ground, --mk-hero-ground.
     *
     * It looks again only when something may have changed there — a change of
     * light, a touch, a scroll coming to rest, a step back — and every couple
     * of seconds besides, for what moves by itself. Each look is a handful of
     * style reads; nothing is drawn or read off the screen. The site's router
     * keeps one document from page to page, so this is set going once a load.
     */
    static final String WATCH = """
        (function () {
          if (!window.MishkatApp || window.__mishkatShell) return;
          window.__mishkatShell = true;
          var root = document.documentElement;
          var pad = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
          pad.canvas.width = pad.canvas.height = 1;
          function rgba(css) {
            pad.clearRect(0, 0, 1, 1);
            pad.fillStyle = '#000';
            pad.fillStyle = css;
            pad.fillRect(0, 0, 1, 1);
            return pad.getImageData(0, 0, 1, 1).data;
          }
          function lum(c) {
            return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
          }
          function ground(el) {
            for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
              var cs = getComputedStyle(n);
              var c = rgba(cs.backgroundColor);
              if (c[3] > 200) return c;
              if (cs.backgroundImage !== 'none' && n.offsetWidth >= innerWidth * 0.6) {
                var hero = getComputedStyle(root).getPropertyValue('--mk-hero-ground').trim();
                if (hero) return rgba(hero);
              }
            }
            return rgba(getComputedStyle(document.body).backgroundColor);
          }
          function edge(y) {
            var el = document.elementFromPoint(innerWidth / 2, y) || document.body;
            var g = ground(el);
            var ink = rgba(getComputedStyle(el).color);
            var dark = ink[3] > 0 ? lum(ink) > 0.5 : lum(g) < 0.5;
            return [(g[0] << 16) | (g[1] << 8) | g[2], dark];
          }
          var shown = '';
          function look() {
            var top = edge(1);
            var foot = edge(innerHeight - 2);
            var key = top.join() + '|' + foot.join();
            if (key === shown) return;
            shown = key;
            MishkatApp.edges(top[0], top[1], foot[0], foot[1]);
          }
          var lit = '';
          function light() {
            var name = root.dataset.theme || 'evening';
            if (name === lit) return;
            lit = name;
            MishkatApp.light(name);
          }
          var resting = 0;
          function rest(ms) {
            clearTimeout(resting);
            resting = setTimeout(look, ms);
          }
          function later() {
            setTimeout(look, 350);
            setTimeout(look, 1100);
          }
          new MutationObserver(function () {
            light();
            rest(60);
            setTimeout(look, 700);
          }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
          addEventListener('scroll', function () { rest(160); }, { capture: true, passive: true });
          addEventListener('pointerup', later, true);
          addEventListener('popstate', later);
          addEventListener('resize', function () { rest(160); });
          setInterval(function () { if (!document.hidden) look(); }, 2000);
          light();
          look();
        })();
        """;

    private static final Map<String, String> HEADERS = Map.of("Cache-Control", "no-cache");

    /** Whether a page has reached the screen yet: the splash screen waits for it (MainActivity). */
    static volatile boolean shown;

    private final Bridge bridge;
    private final Shell shell;

    Pages(Bridge bridge, Shell shell) {
        super(bridge);
        this.bridge = bridge;
        this.shell = shell;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        WebResourceResponse page = page(request.getUrl());
        return page != null ? page : super.shouldInterceptRequest(view, request);
    }

    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        shell.recitation().reset();
    }

    @Override
    public void onPageCommitVisible(WebView view, String url) {
        super.onPageCommitVisible(view, url);
        shown = true;
        view.evaluateJavascript(WATCH, null);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        view.evaluateJavascript(WATCH, null);
    }

    /** A page's folder answered with its index.html, or null for anything that is not a page of this site. */
    private WebResourceResponse page(Uri url) {
        String path = url.getPath();
        String last = url.getLastPathSegment();
        if (!bridge.getHost().equals(url.getHost()) || path == null || last == null || last.contains(".")) {
            return null;
        }
        String folder = path.endsWith("/") ? path : path + "/";
        AssetManager assets = bridge.getContext().getAssets();
        try {
            return html(200, "OK", assets.open("public" + folder + "index.html"));
        } catch (IOException missing) {
            try {
                return html(404, "Not Found", assets.open("public/404.html"));
            } catch (IOException e) {
                return null;
            }
        }
    }

    private static WebResourceResponse html(int status, String reason, InputStream body) {
        return new WebResourceResponse("text/html", "utf-8", status, reason, HEADERS, body);
    }
}
