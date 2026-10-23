package io.github.ibntaymiyyahmajmu.mishkat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/**
 * The recitation as the phone sees it — the notification, the lock screen, a
 * headset's buttons, a car's dashboard — and what keeps it playing when the
 * reader puts the phone away.
 *
 * <p>The site already says all of this to a browser, through the Media
 * Session API (src/lib/audio/player.tsx and nowPlaying.tsx), and Chrome makes
 * the notification of it and, while the recitation plays, keeps the page
 * running behind other apps. Android's WebView has no Media Session API, so in
 * the app the site's words went nowhere, and a recitation stopped soon after
 * the app left the screen. {@link #SHIM} gives the page the API, before the
 * site's own scripts run, and this does with what the page tells it what
 * Chrome would: a media session, with its notification, and a foreground
 * service for as long as the recitation is playing — which is what Android
 * asks of an app that plays to someone who is not looking at it.
 */
final class Recitation {

    /**
     * navigator.mediaSession and MediaMetadata, as far as the site uses them,
     * passed through to the app; and __mishkatMedia, by which the app hands
     * back a press of a button, to the handler the site set for it.
     */
    static final String SHIM = """
        (function () {
          if (!window.MishkatApp || 'mediaSession' in navigator) return;
          var handlers = {};
          var metadata = null;
          var state = 'none';
          if (!window.MediaMetadata) {
            window.MediaMetadata = function (init) {
              init = init || {};
              this.title = init.title || '';
              this.artist = init.artist || '';
              this.album = init.album || '';
              this.artwork = init.artwork || [];
            };
          }
          function artwork(list) {
            var first = list && list[0];
            return first && first.src ? new URL(first.src, location.href).href : '';
          }
          var session = {
            get metadata() { return metadata; },
            set metadata(value) {
              metadata = value || null;
              MishkatApp.nowPlaying(
                metadata ? String(metadata.title || '') : '',
                metadata ? String(metadata.artist || '') : '',
                metadata ? String(metadata.album || '') : '',
                metadata ? artwork(metadata.artwork) : ''
              );
            },
            get playbackState() { return state; },
            set playbackState(value) {
              state = String(value);
              MishkatApp.playbackState(state);
            },
            setActionHandler: function (action, handler) {
              if (handler) handlers[action] = handler;
              else delete handlers[action];
              MishkatApp.actions(Object.keys(handlers).join(','));
            },
            setPositionState: function (place) {
              place = place || {};
              MishkatApp.position(Number(place.duration) || 0, Number(place.position) || 0, Number(place.playbackRate) || 1);
            },
            setCameraActive: function () {},
            setMicrophoneActive: function () {},
          };
          Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true, enumerable: true });
          window.__mishkatMedia = function (action, seconds) {
            var handler = handlers[action];
            if (handler) handler({ action: action, seekTime: seconds });
          };
        })();
        """;

    static final int NOTIFICATION = 1;
    private static final String CHANNEL = "recitation";

    /**
     * How long a pause lasts before the app stops asking to be kept running.
     * The breath between two ayat is not a pause, and nor is the moment a
     * surah gives way to the next.
     */
    private static final long LETTING_GO = 5000;

    /** The recitation there is, if any: the service asks it for its notification. */
    static Recitation current;

    private final Bridge bridge;
    private final Context context;
    private final NotificationManager notifications;
    private final MediaSession session;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable letGo = RecitationService::release;

    private String title = "";
    private String artist = "";
    private String album = "";
    private String artworkUrl = "";
    private Bitmap artwork;
    private String state = "none";
    private Set<String> actions = new HashSet<>();
    private long duration = -1;
    private long position;
    private float rate = 1;
    private long positionAt;

    Recitation(Bridge bridge) {
        this.bridge = bridge;
        this.context = bridge.getContext().getApplicationContext();
        notifications = context.getSystemService(NotificationManager.class);
        session = new MediaSession(context, "Mishkat");
        session.setCallback(
            new MediaSession.Callback() {
                @Override
                public void onPlay() {
                    act("play", 0);
                }

                @Override
                public void onPause() {
                    act("pause", 0);
                }

                @Override
                public void onSkipToNext() {
                    act("nexttrack", 0);
                }

                @Override
                public void onSkipToPrevious() {
                    act("previoustrack", 0);
                }

                @Override
                public void onSeekTo(long millis) {
                    act("seekto", millis / 1000.0);
                }

                @Override
                public void onStop() {
                    act("stop", 0);
                }
            },
            main
        );
        session.setSessionActivity(openApp());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                context.getString(R.string.recitation_channel),
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setShowBadge(false);
            notifications.createNotificationChannel(channel);
        }
        current = this;
    }

    // ── what the page says (Shell.Page, on the WebView's thread) ──────────────

    void nowPlaying(String title, String artist, String album, String artworkUrl) {
        main.post(() -> {
            this.title = title;
            this.artist = artist;
            this.album = album;
            if (!artworkUrl.equals(this.artworkUrl)) {
                this.artworkUrl = artworkUrl;
                artwork = load(artworkUrl);
            }
            publish();
        });
    }

    void playbackState(String state) {
        main.post(() -> {
            this.state = state;
            publish();
        });
    }

    void actions(String names) {
        main.post(() -> {
            actions = new HashSet<>(Arrays.asList(names.split(",")));
            publish();
        });
    }

    void position(double duration, double position, double rate) {
        main.post(() -> {
            this.duration = duration > 0 ? Math.round(duration * 1000) : -1;
            this.position = Math.round(position * 1000);
            this.rate = (float) rate;
            positionAt = SystemClock.elapsedRealtime();
            publish();
        });
    }

    /** A page was loaded afresh, and whatever was playing on the last one has gone with it. */
    void reset() {
        main.post(() -> {
            state = "none";
            title = artist = album = "";
            actions.clear();
            duration = -1;
            publish();
        });
    }

    // ── what the reader does (the session, or the notification's buttons) ─────

    /** Hands a button to the page, which does what its own transport would. */
    void act(String action, double seconds) {
        main.post(() ->
            bridge.getWebView().evaluateJavascript("window.__mishkatMedia && __mishkatMedia(" + JSONObject.quote(action) + ", " + seconds + ")", null)
        );
    }

    /** The app is closing: nothing is left playing, and nothing claims to be. */
    void close() {
        main.removeCallbacks(letGo);
        context.stopService(new Intent(context, RecitationService.class));
        notifications.cancel(NOTIFICATION);
        session.setActive(false);
        session.release();
        if (current == this) current = null;
    }

    boolean playing() {
        return "playing".equals(state);
    }

    // ── what the phone is told ────────────────────────────────────────────────

    private void publish() {
        if ("none".equals(state) || title.isEmpty()) {
            main.removeCallbacks(letGo);
            context.stopService(new Intent(context, RecitationService.class));
            notifications.cancel(NOTIFICATION);
            session.setActive(false);
            return;
        }
        session.setMetadata(
            new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, duration)
                .putBitmap(MediaMetadata.METADATA_KEY_ART, artwork)
                .build()
        );
        session.setPlaybackState(
            new PlaybackState.Builder()
                .setActions(transport())
                .setState(playing() ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, position, playing() ? rate : 0, positionAt)
                .build()
        );
        session.setActive(true);

        if (playing()) {
            main.removeCallbacks(letGo);
            if (!RecitationService.holding()) {
                try {
                    ContextCompat.startForegroundService(context, new Intent(context, RecitationService.class));
                } catch (IllegalStateException refused) {
                    // Android will not start a service for an app that is out of
                    // sight unless the reader has just touched it — a button on
                    // the notification, a headset. The notification is still shown.
                }
            }
        } else {
            main.removeCallbacks(letGo);
            main.postDelayed(letGo, LETTING_GO);
        }
        notifications.notify(NOTIFICATION, notification());
    }

    private long transport() {
        long mask = 0;
        if (actions.contains("play")) mask |= PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE;
        if (actions.contains("pause")) mask |= PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE;
        if (actions.contains("previoustrack")) mask |= PlaybackState.ACTION_SKIP_TO_PREVIOUS;
        if (actions.contains("nexttrack")) mask |= PlaybackState.ACTION_SKIP_TO_NEXT;
        if (actions.contains("seekto")) mask |= PlaybackState.ACTION_SEEK_TO;
        if (actions.contains("stop")) mask |= PlaybackState.ACTION_STOP;
        return mask;
    }

    /**
     * The notification. From Android 13 the system draws its own media
     * controls from the session, and the buttons here are for the versions
     * before it.
     */
    @SuppressWarnings("deprecation")
    Notification notification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(context, CHANNEL)
            : new Notification.Builder(context).setPriority(Notification.PRIORITY_LOW);
        builder
            .setSmallIcon(R.drawable.lamp)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setLargeIcon(artwork)
            .setContentIntent(openApp())
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            .setOngoing(playing())
            .setOnlyAlertOnce(true);
        int shown = 0;
        int[] compact = new int[3];
        if (actions.contains("previoustrack")) {
            builder.addAction(button(R.drawable.previous, R.string.recitation_previous, "previoustrack"));
            compact[shown] = shown++;
        }
        builder.addAction(
            playing()
                ? button(R.drawable.pause, R.string.recitation_pause, "pause")
                : button(R.drawable.play, R.string.recitation_play, "play")
        );
        compact[shown] = shown++;
        if (actions.contains("nexttrack")) {
            builder.addAction(button(R.drawable.next, R.string.recitation_next, "nexttrack"));
            compact[shown] = shown++;
        }
        builder.setStyle(
            new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(Arrays.copyOf(compact, shown))
        );
        return builder.build();
    }

    private Notification.Action button(int icon, int label, String action) {
        Intent intent = new Intent(context, RecitationService.class).putExtra(RecitationService.ACTION, action).setAction(action);
        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pending = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? PendingIntent.getForegroundService(context, action.hashCode(), intent, flags)
            : PendingIntent.getService(context, action.hashCode(), intent, flags);
        return new Notification.Action.Builder(Icon.createWithResource(context, icon), context.getString(label), pending).build();
    }

    private PendingIntent openApp() {
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** The artwork the page names, read from the app's own copy of the site; nothing from elsewhere. */
    private Bitmap load(String url) {
        Uri uri = Uri.parse(url);
        if (url.isEmpty() || !bridge.getHost().equals(uri.getHost()) || uri.getPath() == null) return null;
        try (InputStream in = context.getAssets().open("public" + uri.getPath())) {
            return BitmapFactory.decodeStream(in);
        } catch (IOException missing) {
            return null;
        }
    }
}
