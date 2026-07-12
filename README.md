# alexa-skill-charge-janken

子供の伝統的な手遊び「CCレモンゲーム」「バトルじゃんけん」をモチーフにした、Alexaスキル（音声対戦ゲーム）です。

MVPのコードとCI/CD定義は実装済みです。確定した技術方針、MVP仕様、CI/CDの判断基準は[実装引き継ぎ](docs/implementation-handoff.md)にまとめています。development環境への初回デプロイとAlexa実機テストは未完了です。

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
5. Alexaは初手は「溜め」、以降はパワーの範囲で可能な行動をランダムに選択
6. 両者の行動を照合し、勝敗 or 継続を音声で結果通知
7. 勝敗が決まったら、Alexa「（あなた/私）の勝ちです。もう一回やりますか？」

### インテント設計

- `ActionIntent` + `ACTION_TYPE`スロット（溜め・攻撃・防御）
- `StartGameIntent`（ゲーム開始）
- `AMAZON.YesIntent` / `AMAZON.NoIntent`（ゲーム開始・再戦確認用）
- `AMAZON.HelpIntent`
- `AMAZON.FallbackIntent`
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
- `skill-package/` — 対話モデル・スキルマニフェスト
- `infrastructure/bootstrap.yaml` — GitHub OIDCとデプロイロールの初回構築
- `.github/workflows/` — CI/CDパイプライン定義
- `template.yaml` — AWS SAMテンプレート
- `ask-resources.json` — ASK CLIのメタデータデプロイ設定

## セットアップ

実装の判断基準は[実装引き継ぎ](docs/implementation-handoff.md)です。AWS/Alexaの認証情報をこのリポジトリへ保存せず、development環境だけをGitHub Actionsから更新します。Alexa Storeへの公開は行いません。

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

作業ブランチとmainは同じdevelopment stackとAlexa development stageを更新するため、同時実行は `concurrency` で直列化します。成功したLambda ARNだけを使い、ASK CLIのSMAPIコマンドでマニフェストと対話モデルを個別に更新します。live環境やStore公開は更新しません。

初回作成に失敗したapplication stackが `ROLLBACK_COMPLETE` の場合、そのstackは更新できません。原因を修正したことを確認してから、AWS ConsoleまたはCloudShellで対象stackを一度だけ手動削除してください。GitHub Actionsにはstack削除権限を持たせません。

Skill IDが空・placeholder・形式不正・`config/deployment.json` と不一致のとき、deploy workflowはAWSへ接続する前に失敗します。

### 対話モデルの反映確認

CIは認証情報なしでLambdaのlint・型チェック・テスト・build、SAM validate/build、対話モデルJSONを検証します。development deployでは、ASK CLIが対話モデルのFull Buildを最大2分待ちます。

デプロイ後の動作確認はDeveloper ConsoleのTestタブで行い、最後にEcho実機で発話後のマイク開始、reprompt、認識しやすさを確認してください。発話ログ・ユーザーID・生の発話はLambdaへ記録しません。

## ライセンス

MIT License
