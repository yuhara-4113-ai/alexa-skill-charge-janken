# alexa-skill-charge-janken

子供の伝統的な手遊び「CCレモンゲーム」「バトルじゃんけん」をモチーフにした、Alexaスキル（音声対戦ゲーム）です。

MVPのコードとCI/CD定義は実装済みです。development環境へのAWS Lambda・Alexa対話モデルのデプロイとEcho実機テストを確認済みです。

## ゲームルール

プレイヤーとAlexaの1対1対戦。各ラウンドで以下いずれかの行動を選び、勝敗を判定します。

- **チャージ**: パワーを1増やす
- **ビーム**: パワーを1消費する威力1の技
- **ファイアー**: パワーを2消費する威力2の技
- **ブラックホール**: パワーを3消費する威力3の技。ガードを貫通する
- **ガード**: パワーを消費せず、ビームとファイアーを防ぐ

ビーム、ファイアー、ブラックホールはすべてチャージに勝ち、技同士では威力が高い方が勝ちます。同じ威力なら勝敗なしで続行します。ガードはビームとファイアーを防ぎますが、ブラックホールには貫通されます。それ以外の組み合わせも勝敗なしで次のラウンドへ進みます。

必要パワーに満たない技は実行されず、パワー・ラウンド・Alexaが先に決めた行動を変えずに再入力を促します。

参考: [ＣＣレモンゲーム（手を2回叩いて溜め・攻撃・防御）](https://sukide.sakura.ne.jp/research/82/)

## Alexaスキルとしての実装イメージ

### 音声フロー例

1. ユーザー「Alexa、〇〇（スキル名）を開いて」
2. Alexa「チャージじゃんけんへようこそ。チャージ、ビーム、ファイアー、ブラックホール、ガードのどれかを言ってね。せーの。」
3. ユーザーが5つの行動のいずれかを発話
4. Alexaが自分の手を伝え、引き分けなら「せーの。」で次の入力を促す
5. Alexaは初手は「チャージ」、以降はパワーの範囲で可能な行動をランダムに選択
6. 両者の行動を照合し、勝敗を音声で結果通知
7. 勝敗が決まったら、Alexa「（あなた/私）の勝ちです。もう一回やりますか？」

Alexaは自分の行動を「チャージ」「ビーム」「ファイアー」「ブラックホール」「ガード」と読み上げます。

### インテント設計

- `ActionIntent` + `ACTION_TYPE`スロット（チャージ・ビーム・ファイアー・ブラックホール・ガード）
- `StartGameIntent`（「スタート」「始める」に加え、「しよう」「勝負しよう」「遊ぼう」「対戦しよう」などの自然なゲーム開始）
- `ReplayYesIntent` / `ReplayNoIntent` と `AMAZON.YesIntent` / `AMAZON.NoIntent`（ゲーム開始・再戦確認用）
- `AMAZON.HelpIntent`
- `AMAZON.FallbackIntent`
- `AMAZON.StopIntent` / `AMAZON.CancelIntent`

### スロット・発話サンプル

- チャージ: 「チャージ」「溜め」「ためる」「ため」
- ビーム: 「ビーム」「ビーモ」「攻撃」「アタック」
- ファイアー: 「ファイアー」「ファイヤー」「ファイア」「ファイヤ」
- ブラックホール: 「ブラックホール」
- ガード: 「ガード」「防御」「バリアー」「バリア」

再戦確認では「はい」や「やる」で続け、「いいえ」や「やらない」で終了できます。再戦開始時は技の一覧を繰り返さず、「せーの。」だけを案内します。対話モデルで行動を解決できない場合も、上記の既知の別名と有効な英語Action IDをLambda側で補完します。さらに「チャー…／ちゃー…」「ビー…／びー…」「ガー…／がー…」で始まる聞き取り結果は、それぞれチャージ、ビーム、ガードとして受け付けます。英語Action IDは大文字・小文字を区別せず、どの技にも対応しない発話は再入力を促します。

スキルは標準の「アレクサ、チャージじゃんけんを開いて」に加え、`StartGameIntent` を使う「アレクサ、チャージじゃんけんで勝負」「アレクサ、チャージじゃんけんで遊ぶ」「アレクサ、チャージじゃんけんで対戦」からも起動できます。いずれもdevelopmentのASKシミュレータで、初手をチャージに固定した同じ第1ラウンドへ進むことを確認済みです。「アレクサ、チャージじゃんけんしよう」はサンプル発話を追加してもシミュレータで成功しなかったため、Store用の起動例には使用せず、Echo実機でのみ追加確認します。

### セッション管理で保持する状態

- 自分のパワー
- 相手（Alexa）のパワー
- 自分の勝ち数 / 相手の勝ち数
- 現在のラウンド数

## アーキテクチャ

- **バックエンド**: AWS Lambda（Node.js）+ TypeScript + ASK SDK v2
- **音声対話モデル**: Alexa Skills Kit カスタムスキル
- **インフラ管理**: AWS SAM
- **AWS認証**: GitHub OIDC（一時認証情報。長期アクセスキーは使わない）
- **CI/CD**: GitHub Actions（PRごとにLint・型チェック・テスト、mainマージでdevelopment環境を更新）
- **責任境界**: SAMがAWSリソース、ASK CLIがAlexaのマニフェスト・対話モデルを管理

## ディレクトリ構成

- `lambda/src/` — スキルのバックエンドロジック（TypeScriptソース）
- `lambda/test/` — ゲームロジック・ハンドラーのユニットテスト
- `lambda/package.json` — ASK SDKと開発ツールの依存関係
- `config/deployment.json` — デプロイ先Skill IDの非機密な正本
- `skill-package/` — 対話モデル・スキルマニフェスト・Storeアイコン
- `docs/store-publication.md` — Store掲載内容、Privacy & Compliance、認定・公開手順
- `docs/privacy-policy.md` — 公開用プライバシーポリシー
- `infrastructure/bootstrap.yaml` — GitHub OIDCとデプロイロールの初回構築
- `.github/workflows/` — CI/CDパイプライン定義
- `template.yaml` — AWS SAMテンプレート
- `ask-resources.json` — ASK CLIのメタデータデプロイ設定

## セットアップ

AWS/Alexaの認証情報をこのリポジトリへ保存せず、通常のデプロイはdevelopment環境だけをGitHub Actionsから更新します。Store公開はdevelopment版の検証・認定を経て行い、通常のデプロイと分離します。公開前の確認項目と手順は[`docs/store-publication.md`](docs/store-publication.md)を参照してください。

### 開発・GitHub操作の方針

- 作業開始前に`git fetch origin`を実行し、最新の`origin/main`を取り込んだブランチで作業します。
- `fetch`、`merge`、`rebase`、`commit`、`push`などのGit操作は、ローカルのGit CLIで行います。
- Pull Requestの作成・更新、レビュー確認、GitHub Actionsの実行・監視は、GitHub CLI（`gh`）で行います。
- ブラウザやGitHub Web UIは原則使用しません。必要な場合は、CLIで実行できない理由・具体的な操作・影響範囲を説明し、事前に許可を得ます。

### ローカル開発

必要なものは Node.js 24、npm、AWS SAM CLI です。`sam local invoke` まで試す場合はDockerも必要です。

```bash
npm --prefix lambda ci
npm --prefix lambda run lint
npm --prefix lambda run typecheck
npm --prefix lambda test
npm --prefix lambda run build
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml
```

Alexaのリクエスト形式で起動処理を確認するには、実在するSkill IDを渡して次を実行します。これはローカル実行であり、AWSへはデプロイしません。

```bash
sam local invoke SkillFunction \
  --event tests/fixtures/alexa-requests/launch.json \
  --parameter-overrides AlexaSkillId=amzn1.ask.skill.実際のSkill_ID
```

### 初回だけ行う設定

1. Alexa Developer Consoleで `Custom` / `Provision your own backend resources` / `ja-JP` のスキルを作成し、表示名・起動名を「チャージじゃんけん」にする。
2. 取得したSkill IDを `config/deployment.json` のplaceholderと、後述のGitHub Variable `ALEXA_SKILL_ID` の両方に同じ値で設定する。
3. ローカル端末で一度だけ `ask configure` を実行し、refresh tokenとVendor IDを取得する。AmazonのID・パスワードや `~/.ask/cli_config` 全体は共有・コミットしない。
4. `infrastructure/bootstrap.yaml` を `us-west-2` に適用する。OIDC providerがAWSアカウントに無い場合は既定値のまま、既存なら `CreateGitHubOidcProvider=false` と `ExistingGitHubOidcProviderArn` を渡す。

```bash
aws cloudformation deploy \
  --region us-west-2 \
  --stack-name alexa-skill-charge-janken-bootstrap \
  --template-file infrastructure/bootstrap.yaml \
  --capabilities CAPABILITY_NAMED_IAM
```

bootstrap完了後、出力の `GitHubPipelineRoleArn`、`CloudFormationExecutionRoleArn`、`ArtifactBucketName` を控えます。既存OIDC providerを使う場合は、例えば次のように明示します。

```bash
aws cloudformation deploy \
  --region us-west-2 \
  --stack-name alexa-skill-charge-janken-bootstrap \
  --template-file infrastructure/bootstrap.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides CreateGitHubOidcProvider=false ExistingGitHubOidcProviderArn=arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com
```

### GitHub Actionsの設定

GitHubに `development` Environmentを作り、deployment branchは `main` と `codex/**` だけを許可します。`main` へのpushは自動デプロイし、`codex/**` は `workflow_dispatch` で明示的に実行した場合だけ同じdevelopment環境へデプロイします。利用できるプランではrequired reviewerも設定します。Environment Variablesには次を登録します。

| Variable | 値 |
|---|---|
| `ALEXA_SKILL_ID` | `config/deployment.json` と同じSkill ID |
| `ASK_VENDOR_ID` | Amazon Developer Vendor ID |
| `AWS_ACCOUNT_ID` | デプロイ先AWSアカウントID |
| `AWS_REGION` | `us-west-2` |
| `AWS_ROLE_ARN` | bootstrapのGitHub Pipeline Role ARN |
| `CFN_EXECUTION_ROLE_ARN` | bootstrapのCloudFormation Execution Role ARN |
| `SAM_ARTIFACT_BUCKET` | bootstrapのartifact bucket名 |
| `SAM_STACK_NAME` | `alexa-skill-charge-janken-dev` |

Environment Secretは `ASK_REFRESH_TOKEN` だけです。`AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` は登録しません。

`main` のRulesetでは、PR、CI成功、CODEOWNERS reviewを必須にし、force pushとbranch削除を禁止してください。CODEOWNERSはworkflowとbootstrap templateを対象にしています。作業ブランチから事前検証するときは、対象の `codex/**` ブランチをpushして次を実行します。

```bash
gh workflow run deploy.yml --ref codex/<ブランチ名>
gh run list --workflow deploy.yml --branch codex/<ブランチ名> --limit 1
gh run watch <run-id> --exit-status
```

作業ブランチとmainは同じdevelopment stackとAlexa development stageを更新するため、同時実行は `concurrency` で直列化します。成功したLambda ARNだけを使い、ASK CLIの`skill-metadata`限定デプロイでマニフェスト・対話モデル・Store画像をまとめて更新します。LambdaとCloudFormationはSAMだけが管理し、このワークフローはlive環境やStore公開を更新しません。

Store認定と公開は手動の`Store release`ワークフローへ分離しています。認定提出は`SUBMIT`、認定済み版の公開は`PUBLISH`の確認文字列を要求し、`main`からしか実行できません。認定提出は常に`MANUAL_PUBLISHING`を使うため、認定後に公開日時を別途決定できます。実行前に[`docs/store-publication.md`](docs/store-publication.md)の実機テストと最終確認を完了してください。

初回作成に失敗したapplication stackが `ROLLBACK_COMPLETE` の場合、そのstackは更新できません。原因を修正したことを確認してから、AWS ConsoleまたはCloudShellで対象stackを一度だけ手動削除してください。GitHub Actionsにはstack削除権限を持たせません。

Skill IDが空・placeholder・形式不正・`config/deployment.json` と不一致のとき、deploy workflowはAWSへ接続する前に失敗します。

### 対話モデルの反映確認

CIは認証情報なしでLambdaのlint・型チェック・テスト・build、SAM validate/build、対話モデルJSONを検証します。development deployでは、ASK CLIが対話モデルのFull Buildを最大2分待ちます。

デプロイ後の動作確認はDeveloper ConsoleのTestタブで行い、最後にEcho実機で発話後のマイク開始、reprompt、認識しやすさを確認してください。発話ログ・ユーザーID・生の発話はLambdaへ記録しません。

## ライセンス

MIT License
