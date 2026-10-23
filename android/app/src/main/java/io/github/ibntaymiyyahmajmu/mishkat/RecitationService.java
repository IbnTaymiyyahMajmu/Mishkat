package io.github.ibntaymiyyahmajmu.mishkat;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Keeps the app running while a recitation plays and the reader is not
 * looking at it. Android lets an app out of sight go on playing only from a
 * foreground service, which shows the recitation's notification for as long
 * as it runs. Everything the notification says is {@link Recitation}'s.
 *
 * <p>It holds the app in the foreground while the recitation plays, and lets
 * go a little after it pauses (Recitation.LETTING_GO), leaving the
 * notification to be played again from or swiped away. The buttons on the
 * notification come here first, so that Android allows the service to hold on
 * again when one of them starts the recitation from out of sight.
 */
public class RecitationService extends Service {

    static final String ACTION = "action";

    private static RecitationService running;
    private boolean holding;

    static boolean holding() {
        return running != null && running.holding;
    }

    /** Stops holding the app in the foreground; the notification stays. */
    static void release() {
        if (running == null || !running.holding) return;
        running.stopForeground(STOP_FOREGROUND_DETACH);
        running.holding = false;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Recitation recitation = Recitation.current;
        if (recitation == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // Whatever started it, Android expects the service in the foreground
        // straight away; a button that pauses lets go again a moment later.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(Recitation.NOTIFICATION, recitation.notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(Recitation.NOTIFICATION, recitation.notification());
        }
        holding = true;
        String action = intent == null ? null : intent.getStringExtra(ACTION);
        if (action != null) recitation.act(action, 0);
        return START_NOT_STICKY;
    }

    /** The app has been swiped away, and the page with it: so has the recitation. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (Recitation.current != null) Recitation.current.close();
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (running == this) running = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
