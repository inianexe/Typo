package com.iniexe.tanglishrewrite
import android.inputmethodservice.InputMethodService
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.text.SpannableString
import android.text.style.ForegroundColorSpan
import android.text.style.BackgroundColorSpan
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.*
import java.util.concurrent.Executors
class RewriteImeService:InputMethodService(){
 private val worker=Executors.newSingleThreadExecutor()
 private val main=Handler(Looper.getMainLooper())
 private var preview:TextView?=null
 private var pending:String?=null
 private var mode="Translate"
 private var tone="Natural"
 override fun onCreateInputView():View{
  val root=LinearLayout(this).apply{orientation=1;setPadding(6,6,6,8);setBackgroundColor(0xfff2f1f6.toInt())}
  val modes=LinearLayout(this)
  modes.addView(Button(this).apply{text="Translate";setOnClickListener{mode="Translate";rewrite()}},LinearLayout.LayoutParams(0,48,1f))
  modes.addView(Button(this).apply{text="Polish";setOnClickListener{mode="Polish";rewrite()}},LinearLayout.LayoutParams(0,48,1f))
  root.addView(modes)
  val tones=LinearLayout(this)
  listOf("Natural","Casual","Formal").forEach{t->tones.addView(Button(this).apply{text=t;setOnClickListener{tone=t;rewrite()}},LinearLayout.LayoutParams(0,42,1f))}
  root.addView(tones)
  preview=TextView(this).apply{text="Type Tanglish, then tap Translate.";textSize=15f;setTextColor(0xff282735.toInt());setPadding(12,8,12,8);minHeight=46;setBackgroundColor(Color.WHITE)}
  root.addView(preview,LinearLayout.LayoutParams(-1,-2))
  val actions=LinearLayout(this)
  actions.addView(Button(this).apply{text="Apply";setOnClickListener{applyRewrite()}},LinearLayout.LayoutParams(0,44,1f))
  actions.addView(Button(this).apply{text="Keep original";setOnClickListener{pending=null;preview?.text="Original kept."}},LinearLayout.LayoutParams(0,44,1f))
  root.addView(actions)
  listOf("qwertyuiop","asdfghjkl","⇧zxcvbnm⌫").forEach{row->val ll=LinearLayout(this);row.forEach{ch->ll.addView(Button(this).apply{text=ch.toString();textSize=17f;setPadding(0,0,0,0);setOnClickListener{key(ch)}},LinearLayout.LayoutParams(0,44,1f).apply{setMargins(2,2,2,2)})};root.addView(ll)}
  val bottom=LinearLayout(this)
  listOf("?123",",","English","↵").forEach{label->bottom.addView(Button(this).apply{text=label;setOnClickListener{when(label){"English"->key(' ');","->key(',');"↵"->currentInputConnection?.sendKeyEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN,android.view.KeyEvent.KEYCODE_ENTER));else->preview?.text="Symbols are not included in this first preview."}}},LinearLayout.LayoutParams(0,44,1f))}
  root.addView(bottom);return root
 }
 private fun key(c:Char){val ic=currentInputConnection?:return;when(c){'⌫'->{if(ic.getSelectedText(0)?.isNotEmpty()==true)ic.commitText("",1) else ic.deleteSurroundingText(1,0)};'⇧'->Unit;else->ic.commitText(c.toString(),1)}}
 override fun onStartInput(attribute:EditorInfo?,restarting:Boolean){super.onStartInput(attribute,restarting);pending=null;val type=attribute?.inputType?:0;if((type and android.text.InputType.TYPE_MASK_VARIATION)==android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD||(type and android.text.InputType.TYPE_MASK_CLASS)==android.text.InputType.TYPE_CLASS_NUMBER)preview?.text="Rewrite is disabled for password and number fields."}
 private fun rewrite(){
  val ic=currentInputConnection?:return
  val selected=ic.getSelectedText(0)?.toString().orEmpty()
  val source=if(selected.isNotBlank())selected.trim() else ic.getTextBeforeCursor(500,0)?.toString()?.substringAfterLast('\n').orEmpty().trim()
  if(source.isBlank()){preview?.text="Select a line, or type it and tap Translate.";return}
  val api=SecurePrefs.get(this);if(api.isBlank()){preview?.text="Open the app and add your Gemini API key first.";return}
  pending=null;preview?.text="Rewriting…"
  val model=getSharedPreferences("settings",0).getString("model","gemini-2.5-flash")?:"gemini-2.5-flash"
  worker.execute{try{val result=GeminiClient.rewrite(api,model,source,mode,tone);main.post{
   pending=result.text;val s=SpannableString(result.text);var cursor=0
   result.segments.forEach{(part,kind)->val idx=result.text.indexOf(part,cursor).takeIf{it>=0}?:cursor;val end=(idx+part.length).coerceAtMost(result.text.length);if(kind=="changed"&&end>idx){s.setSpan(ForegroundColorSpan(0xff5145cd.toInt()),idx,end,SpannableString.SPAN_EXCLUSIVE_EXCLUSIVE);s.setSpan(BackgroundColorSpan(0xffe9e6ff.toInt()),idx,end,SpannableString.SPAN_EXCLUSIVE_EXCLUSIVE)};cursor=end};preview?.text=s
  }}catch(e:Exception){main.post{preview?.text=e.message?:"Rewrite failed. Check network and API key."}}}
 }
 private fun applyRewrite(){
  val value=pending?:return;val ic=currentInputConnection?:return;val selected=ic.getSelectedText(0)?.toString()
  if(!selected.isNullOrEmpty())ic.commitText(value,1) else {val before=ic.getTextBeforeCursor(500,0)?.toString().orEmpty();val line=before.substringAfterLast('\n');val start=line.indexOfFirst{!it.isWhitespace()}.let{if(it<0)line.length else it};val end=line.indexOfLast{!it.isWhitespace()}+1;val prefix=line.substring(0,start);val suffix=line.substring(end);ic.deleteSurroundingText(line.length,0);ic.commitText(prefix+value+suffix,1)}
  pending=null;preview?.text="Applied. Keep typing."
 }
}