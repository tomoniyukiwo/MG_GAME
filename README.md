# BOARDROOM 8

仕入れ・生産・販売・決算を8期で体験する、1人用のMG風経営シミュレーションゲームです。サーバーや外部APIを使わないため、GitHub Pagesでそのまま公開できます。

## 遊び方

1. 原材料の仕入数と製品の生産数を入力します。
2. 販売価格と広告費を決めます。
3. 必要なら社員の採用や設備増設を選びます。
4. 「この計画で第○期を実行」を押して決算します。
5. 全8期終了時の自己資本をできるだけ大きくします。

経営データはブラウザの `localStorage` に保存されます。「最初から」を押すと記録を削除できます。

## ローカルで確認

`dist/index.html` をブラウザで直接開くか、プロジェクトのフォルダーで次を実行します。

```bash
python3 -m http.server 8000 --directory dist
```

その後、<http://localhost:8000> を開きます。

## GitHub Pagesで公開

### 方法A：GitHub Actionsを使わず公開

1. GitHubで新しいリポジトリを作成します。
2. このフォルダーの中身をリポジトリへアップロードします。
3. リポジトリの **Settings → Pages** を開きます。
4. **Build and deployment** の Source を **Deploy from a branch** にします。
5. Branch を `main`、フォルダーを `/docs` にする場合は、`dist` の名前を `docs` に変更してから保存します。

GitHub Pagesは通常、`dist` を直接選べないため、簡単に公開する場合は `dist` を `docs` に変更してください。

### 方法B：GitHub Actionsで `dist` を公開（推奨）

このプロジェクトには `.github/workflows/pages.yml` が入っています。

1. すべてのファイルをGitHubへpushします。
2. **Settings → Pages** のSourceを **GitHub Actions** にします。
3. **Actions** タブで `Deploy GitHub Pages` の完了を待ちます。

以後は `main` ブランチへpushするたびに、自動で最新版が公開されます。

## ファイル構成

```text
mg-business-game/
├── dist/
│   ├── index.html
│   ├── styles.css
│   └── game.js
├── .openai/
│   └── hosting.json
├── .github/workflows/
│   └── pages.yml
└── README.md
```

## 調整しやすい場所

- 全期数：`game.js` の `MAX_ROUNDS`
- 初期資金・在庫：`initialState()`
- 原材料費・生産費：ファイル冒頭の定数
- 市場需要：`marketStates`
- ランダムイベント：`events`

## 注意

本作は経営研修の考え方を参考にした独自の学習ゲームです。特定の公式MG、教材、ルールを複製するものではありません。
