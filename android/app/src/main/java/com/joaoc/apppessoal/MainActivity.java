package com.joaoc.apppessoal;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    // Desabilita zoom e wide viewport (que causa a ampliação)
    WebSettings webSettings = this.bridge.getWebView().getSettings();
    webSettings.setUseWideViewPort(false);
    webSettings.setLoadWithOverviewMode(false);
    webSettings.setBuiltInZoomControls(false);
    webSettings.setDisplayZoomControls(false);
    webSettings.setSupportZoom(false);
  }
}
