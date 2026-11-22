package com.iniexe.tanglishrewrite

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.*

class MainActivity : Activity() {
    private lateinit var key: EditText
    private lateinit var model: EditText
    private lateinit var status: TextView
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); screen() }
    override fun onResume() { super.onResume(); if (::status.isInitialized) refresh() }
    private fun screen() {
        window.statusBarColor = 0xfff7f6fa.toInt(); window.navigationBarColor = 0xfff7f6fa.toInt()
        val root = LinearLayout(this).apply { orientation = 1; setPadding(24, 28, 24, 24); setBackgroundColor(0xfff7f6fa.toInt()) }
        val scroller = ScrollView(this); scroller.addView(root)
        val title = TextView(this).apply { text = "Say it naturally."; textSize = 30f; setTextColor(0xff171621.toInt()); typeface = android.graphics.Typeface.DEFAULT_BOLD }
        root.addView(title)
        root.addView(TextView(this).apply { text = "Tanglish to clear English, from any app."; textSize = 16f; setTextColor(0xff666574.toInt()); setPadding(0,8,0,22) })
        val card = LinearLayout(this).apply { orientation=1; setPadding(18,18,18,18); setBackgroundColor(-1) }
        root.addView(card)
        card.addView(TextView(this).apply { text="1  Add your Gemini API key"; textSize=18f; typeface=android.graphics.Typeface.DEFAULT_BOLD; setTextColor(0xff171621.toInt()) })
        card.addView(TextView(this).apply { text="The key stays encrypted on this phone. Text is sent to Gemini only when you tap Rewrite."; textSize=13f; setTextColor(0xff686777.toInt()); setPadding(0,8,0,8) })
        key = EditText(this).apply { hint="Gemini API key"; inputType= android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD; setText(SecurePrefs.get(this@MainActivity)) }
        card.addView(key)
        model = EditText(this).apply { hint="Gemini model"; setText(getSharedPreferences("settings",0).getString("model","gemini-2.5-flash")); setSingleLine(true) }
        card.addView(model)
        val save = Button(this).apply { text="Save API settings"; setOnClickListener {
            SecurePrefs.save(this@MainActivity,key.text.toString().trim())
            getSharedPreferences("settings",0).edit().putString("model",model.text.toString().trim().ifBlank{"gemini-2.5-flash"}).apply()
            toast("Settings saved")
        } }; card.addView(save)
        val permission = LinearLayout(this).apply { orientation=1; setPadding(18,18,18,18); setBackgroundColor(0xffeeecff.toInt()) }
        permission.addView(TextView(this).apply { text="2  Enable the keyboard"; textSize=18f; typeface=android.graphics.Typeface.DEFAULT_BOLD; setTextColor(0xff171621.toInt()) })
        permission.addView(TextView(this).apply { text="Android will ask you to enable Tanglish Rewrite, then choose it as your keyboard. No overlay permission is needed."; textSize=14f; setTextColor(0xff514d66.toInt()); setPadding(0,8,0,8) })
        permission.addView(Button(this).apply { text="Open keyboard settings"; setOnClickListener { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) } })
        permission.addView(Button(this).apply { text="Choose keyboard"; setOnClickListener { (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker() } })
        root.addView(permission)
        status=TextView(this).apply { textSize=14f; setPadding(0,16,0,0); setTextColor(0xff514d66.toInt()) }
        root.addView(status); refresh()
        setContentView(scroller)
    }
    private fun refresh() {
        val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_INPUT_METHODS).orEmpty().contains(packageName)
        status.text = if (enabled) "Keyboard enabled. Choose it in any text field." else "Keyboard not enabled yet."
    }
    private fun toast(s:String) = Toast.makeText(this,s,Toast.LENGTH_SHORT).show()
}
