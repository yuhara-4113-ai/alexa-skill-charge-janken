# alexa-skill-charge-janken
子供の伝統的な手遊び「CCレモンゲーム」「バトルじゃんけん」をモチーフにした、 Alexaスキル（音声対戦ゲーム）です

## ゲームルール

プレイヤーとAlexaの1対1対戦。各ラウンドで以下いずれかの行動を選び、勝敗を判定します。

- **溜め（チャージ）**: パワーを1増やす
- **攻撃**: パワーを1消費して相手を攻撃する
- **防御**: パワーを消費せず攻撃を防ぐ

| あなた | 相手 | 結果 |
|---|---|---|
| 攻撃 | 溜め | あなたの勝ち |
| 溜め | 攻撃 | 相手の勝ち |
| その他の組み合わせ | | 引き分け（継続） |

→ 要するに「攻撃 vs 溜め」の組み合わせのときだけ勝敗が決まり、
それ以外は全て引き分け（次のラウンドへ継続）。

参考: [ＣＣレモンゲーム（手を2回叩いて溜め・攻撃・防御）](https://sukide.sakura.ne.jp/research/82/)

## Alexaスキルとしての実装イメージ

### 音声フロー例
1. ユーザー「Alexa、〇〇（スキル名）を開いて」
2. Alexa「準備はいい？」
3. Alexa「せーの」の掛け声
4. ユーザーが「溜め」「攻撃」「防御」のいずれかを発話
5. Alexaは初手は「溜め」、以降はAI的な戦略（レベル設定で弱、中、強により）で行動を選択
6. 両者の行動を照合し、勝敗 or 継続を音声で結果通知
7. 勝敗が決まったら、Alexa「（あなた/私）の勝ちです。一回やりますか？」

### インテント設計（案）
- `ChargeIntent`（溜め）
- `AttackIntent`（攻撃）
- `DefendIntent`（防御）
- `AMAZON.YesIntent` / `AMAZON.NoIntent`（ゲーム開始・再戦確認用）
- `AMAZON.HelpIntent`
- `AMAZON.StopIntent` / `AMAZON.CancelIntent`

### スロット・発話サンプル（案）
- 溜め: 「ためる」「チャージ」「溜め」
- 攻撃: 「攻撃」「アタック」「ビーム」
- 防御: 「防御」「ガード」「バリア」

### セッション管理で保持する状態
- 自分のパワー
- 相手（Alexa）のパワー
- 自分の勝ち数 / 相手の勝ち数
- 現在のラウンド数

## アーキテクチャ
一旦仮で考えてみたので管理しやすい方法があれば教えてください

- **バックエンド**: AWS Lambda（Node.js）+ TypeScript + ASK SDK v2
- **音声対話モデル**: Alexa Skills Kit カスタムスキル
- **インフラ管理**: AWS SAM or AWS CDK のやりやすい方でOK（IaC）
- **CI/CD**: GitHub Actions（PRごとにLint・型チェック・テスト実行、mainマージで自動ビルド＆デプロイ）

## ディレクトリ構成
一旦仮で考えてみたので管理しやすい方法があればそっちでOKです

- `lambda/src/` — スキルのバックエンドロジック（TypeScriptソース）
- `lambda/dist/` — ビルド後のJavaScript（Lambdaへのデプロイ対象、gitignore対象）
- `skill-package/` — 対話モデル・スキルマニフェスト
- `.github/workflows/` — CI/CDパイプライン定義
- `template.yaml` — AWS SAMテンプレート
- `tsconfig.json` — TypeScriptコンパイル設定

## セットアップ

（今後追記）

## ライセンス

MIT License
