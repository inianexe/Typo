# Tanglish Rewrite for Android

First mobile prototype: a native Android keyboard that rewrites Tanglish or English in the active text field using your Gemini API key.

## Use

1. Install the debug APK from the GitHub Actions artifact.
2. Open Tanglish Rewrite and enter a Gemini API key. The key is encrypted with Android Keystore on device.
3. Open keyboard settings and enable Tanglish Rewrite Keyboard, then choose it in a text field.
4. Type a sentence, tap Translate or Polish, choose Natural/Casual/Formal, review the purple highlights, and tap Apply.

Text is sent to Gemini only after the user taps a rewrite button. The keyboard is disabled in password and numeric fields. Android keyboards cannot recolor text inside WhatsApp or other host apps, so change highlights appear in the keyboard preview before Apply.

This uses Android's InputMethodService because an IME can access the active editor through InputConnection and commit replacement text. A floating overlay permission alone cannot safely edit arbitrary app fields; this app does not request overlay permission.

## First version limits

The prototype includes English QWERTY keys, backspace, enter, rewrite preview, and line/selection replacement. It does not yet include a symbol/number keyboard, dictation, offline model, history, or Play Store signing. API/model access depends on the user's Google AI Studio key and selected Gemini model.
