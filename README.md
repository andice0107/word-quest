# 語詞闖關遊戲：午夜12點・消失的語詞魔法書

國小語詞學習的劇情闖關遊戲。6 個房間、36 道語詞咒語、線索本與推理機關。

- 遊戲（直接按「推開古堡大門」＝預設設定的單人冒險）：https://andice0107.github.io/word-quest/
- 冒險篇章（遊戲前設定）：https://andice0107.github.io/word-quest/adventure.html
  - 抽題數、破關後是否再挑戰（重新抽題／抽過不再抽，全部抽完才是終極破關）
  - 每題作答時限（可設定秒數）、過關總時間計時
  - 單人冒險或多人闖關（最多 30 人）
  - 多人：商人出現機率（預設 60%）與交易時間（預設 60 秒）、精靈出現機率（預設 30%）、每幾關用一次魔法卡（預設 5 關）與每人使用時間（預設 30 秒）
- 多人闖關教師大螢幕：host.html（由冒險篇章進入），學生掃 QR code 開 play.html 加入
- 老師換題目：https://andice0107.github.io/word-quest/teacher.html（下載 Excel 題本 → 修改 → 上傳 → 套用或產生分享連結）

多人連線透過免費公開的 MQTT 中繼伺服器（broker.emqx.io，備用 broker.hivemq.com），不需要帳號；
只傳送暱稱、分數與作答，請學生使用暱稱。網址加上 `?local=1` 可在同一台電腦用多個分頁測試。

插畫與音效來自作者在 Padlet Arcade Wildcard 製作的原版遊戲。
