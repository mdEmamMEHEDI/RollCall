package bd.edu.diu.rollcall;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RollCallBlePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
