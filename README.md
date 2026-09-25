# MARKET MAKERS

1人1社の社長となり、材料購入・製造・投資・入札販売を繰り返すブラウザ向け経営シミュレーションゲームです。

- **1人用**：AI企業3社と対戦
- **オンライン対戦**：同じURLに接続した2～6人がルームコードで対戦
- **3期制**：1期10手、最終自己資本で順位を決定
- **販売コンペ**：全社が価格と数量を秘密入札
- **自動決算**：PQ・VQ・F・Gと自己資本を表示

> 公式MGの複製ではありません。公開されている経営研修の概要を参考にしつつ、数値、画面、進行、勝敗条件を独自設計した学習ゲームです。

## ゲームの流れ

1. 各社が順番に経営行動を1つ選びます。
2. 材料を購入し、製造能力の範囲で製品を作ります。
3. 販売コンペでは、全参加者が販売数と価格を秘密入札します。
4. 安い価格、広告力、品質の順で落札順位が決まります。
5. 10手で期末決算を行い、固定費、在庫費、借入利息を支払います。
6. 3期終了後、自己資本が最も多い会社が1位です。

## 経営行動

| 行動 | 内容 |
| --- | --- |
| 材料購入 | 市場を選び、材料を仕入れる |
| 製造 | 材料と現金を使って製品を作る |
| 販売コンペ | 市場を選び、全社で秘密入札する |
| 採用 | 社員を増やし製造能力を高める |
| 設備投資 | 機械を増やし製造能力を高める |
| 広告 | 同価格の入札で有利になる |
| 研究開発 | 広告力も同じ場合に品質で有利になる |
| 社員教育 | 製造能力を高める |
| 銀行借入 | 現金を30万円増やす。期末に利息が発生する |
| 何もしない | 資金を使わず手番を終える |

## ローカルで起動

```bash
python3 -m http.server 8000 --directory dist
```

ブラウザで <http://localhost:8000> を開きます。Firebase未設定でも「1人で練習」は利用できます。

## オンライン対戦の設定

オンライン対戦には、Firebase AuthenticationとRealtime Databaseを使用します。Firebaseの無料枠でも小規模なテストが可能です。

### 1. Firebaseプロジェクトを作る

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成します。
2. 「アプリを追加」からWebアプリを登録します。
3. 表示されたFirebase構成情報を控えます。

### 2. 匿名認証を有効にする

1. **Authentication → Sign-in method** を開きます。
2. **Anonymous（匿名）** を有効にします。

### 3. Realtime Databaseを作る

1. **Realtime Database → Create Database** を選択します。
2. 利用地域を選び、データベースを作成します。
3. `database.rules.json` の内容をRealtime Databaseの **Rules** に貼り付けて公開します。

テストモードのまま公開しないでください。テストモードでは第三者がデータを読み書きできる可能性があります。

### 4. Firebase設定を入力する

`dist/firebase-config.js` を開き、Firebase Consoleに表示された内容へ置き換えます。

```javascript
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "プロジェクトID.firebaseapp.com",
  databaseURL: "https://プロジェクトID-default-rtdb.firebaseio.com",
  projectId: "プロジェクトID",
  appId: "..."
};
```

FirebaseのWeb APIキーはクライアントアプリを識別する設定値であり、単独で管理権限を与える秘密鍵ではありません。アクセス制御はAuthenticationとDatabase Rulesで行います。

## GitHub Pagesへ公開

1. プロジェクト一式をGitHubリポジトリへpushします。
2. **Settings → Pages** を開きます。
3. **Source** を **GitHub Actions** にします。
4. **Actions** の `Deploy GitHub Pages` が完了するまで待ちます。

`.github/workflows/pages.yml` が `dist` フォルダーを自動公開します。以後、`main` ブランチへpushするたびに更新されます。

公開URLの形式：

```text
https://ユーザー名.github.io/リポジトリ名/
```

## ファイル構成

```text
.
├── dist/
│   ├── index.html
│   ├── styles.css
│   ├── game.js
│   └── firebase-config.js
├── .github/workflows/pages.yml
├── database.rules.json
└── README.md
```

## 現在のオンライン版について

この版は、少人数で遊ぶための試作版です。ルーム参加者のブラウザからゲーム状態を更新する方式のため、公開大会や賞金付き対戦など、不正対策が必要な用途には適していません。本格運用では、ゲーム判定をCloud Functionsなどのサーバー側へ移す必要があります。
