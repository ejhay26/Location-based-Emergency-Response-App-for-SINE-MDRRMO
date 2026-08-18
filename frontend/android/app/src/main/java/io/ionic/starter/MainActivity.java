package io.ionic.starter;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must register before super.onCreate() — that's where Capacitor's
        // bridge finishes initializing and starts loading plugins.
        registerPlugin(WidgetPinnerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
