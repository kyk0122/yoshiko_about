「よしこについて」公開Webページ

使い方
1. npm install を実行します。
2. npm run dev でローカル確認できます。
3. npm run build で公開用の dist フォルダを生成します。
4. 公開するときは dist フォルダの中身をGitHub Pages等へ置けます。
5. 文章は index.html の日本語部分を直接編集してください。
6. よしこのVRMは models/yoshiko.vrm です。読み込み失敗時は images/yoshiko.png を表示します。

構成
- index.html：本文とページ構造
- style.css：色・レイアウト・スマートフォン表示
- viewer.js：VRM読み込み・表示・Pointer Events
- turntable-state.js：自動回転と手動回転の状態管理
- models/yoshiko.vrm：紹介Webで表示するVRM
- images/yoshiko.png：3D読み込み失敗時の画像

3D表示にはローカルbundleしたThree.jsと@pixiv/three-vrmを使用します。
Cookie、フォーム、アクセス解析は使用していません。
