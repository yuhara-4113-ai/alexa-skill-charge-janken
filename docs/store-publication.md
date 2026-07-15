# Alexa Skills Store公開手順

この文書は、「チャージじゃんけん」を日本のAlexa Skills Storeへ公開するための掲載内容、Privacy & Complianceの判断根拠、認定テスト、申請手順をまとめたものです。

## Store掲載内容

`skill-package/skill.json`を正本とします。掲載内容を変更した場合は、この文書と重複して保守せず、必ずmanifestを確認してください。

- スキル名: チャージじゃんけん
- カテゴリ: `GAMES`
- ロケール・配布国: `ja-JP` / 日本
- 想定利用者: 子供専用ではない一般利用者。Alexaを相手に1人で遊ぶ短時間の音声ゲーム
- 起動例: 「開いて」「で勝負」「で遊ぶ」の3件。いずれも対話モデルとdevelopmentシミュレータで確認済みの表現
- アイコン: `skill-package/assets/images/charge-janken-108.png`と`charge-janken-512.png`

アイコンはIssue #12でオーナーが選定した画像です。文字、数字、AlexaやAmazonのロゴ、既存キャラクターは含まれていません。108px版でも中央の手とチャージ表現を識別できることを確認しています。

Store掲載文では「ビーム」「ガード」など実際の音声案内と同じ技名を使います。「対戦」はAlexaとの1人用ゲームであることを明記し、オンライン対戦や複数人プレイと誤認させる表現は使いません。「じゃんけん」は一般的なグー・チョキ・パーではなく、パワーを管理するターン制ゲームとして説明します。

## Privacy & Compliance

2026年7月16日時点の実装と掲載内容から、manifestには次の値を設定しています。認定申請の直前に、Developer Consoleの最新設問全文と実際の機能をオーナーが再確認します。

| 項目 | 値 | 実装上の根拠 |
|---|---:|---|
| `usesPersonalInfo` | `false` | 個人情報、ユーザーID、位置情報、生の発話を取得・保存する処理がない |
| `allowsPurchases` | `false` | ISP、Paid Skill、Shopping Actions、外部購入導線がない |
| `containsAds` | `false` | 広告、スポンサー、アフィリエイト、クロスプロモーションがない |
| `isChildDirected` | `false` | 一般利用者向けの`GAMES`であり、16歳未満を主対象とする説明・機能・宣伝を行わない |
| `isExportCompliant` | `true` | 独自暗号、暗号製品、規制対象のセキュリティ機能を実装せず、通常のAWS・HTTPSとASK SDKだけを利用する |

コードとインフラで確認した事項:

- LambdaはAlexaリクエスト全体、`userId`、`deviceId`、`personId`、アクセストークン、スロットの生値をログへ出力しない
- ゲーム状態はAlexaのセッション属性だけで管理し、DynamoDB、S3などへ永続化しない
- CloudWatch Logsの保持期間は`template.yaml`で14日
- LambdaのIAM権限はCloudWatch Logsへの書き込みだけ
- アカウント連携、権限API、外部分析、広告、課金の設定はない
- 日本で16歳未満を主対象とする内容へ変更する場合は、`isChildDirected`、カテゴリ、掲載文、子供向けスキルの追加要件をまとめて再検討する
- ライブラリや配布内容を変更した場合は、輸出コンプライアンスを再確認する

プライバシーポリシーは[`docs/privacy-policy.md`](privacy-policy.md)を正本とし、manifestにはログイン不要で閲覧できる公開URLを設定します。運営者名と問い合わせ先を変更する場合は、認定申請前に文書と公開URLを更新します。

## 認定テスト

外部アカウントとの連携やテスト用ログイン情報は不要です。Alexaの行動は最初のターンを除いてランダムなため、勝敗までの手数は変動します。Developer ConsoleのTesting Instructionsには`skill-package/skill.json`の手順を貼り付けます。

認定前に、少なくとも次をdevelopmentシミュレータとEcho実機で確認します。

- 3つのStore起動例
- 5つの行動と別名（溜め、攻撃、防御を含む）
- パワー不足時に同じラウンドのまま再入力できること
- HelpとFallback後もゲームを続けられること
- StopとCancelで終了すること
- 勝敗後に「はい」「やる」で初期化して再戦できること
- 「いいえ」「やらない」で通算勝敗を案内して終了すること
- 発話後にマイクが開き、repromptが聞き取りやすいこと

## 認定・公開の流れ

Alexaの更新はdevelopment stageに対して行います。live stageへmanifestや対話モデルを直接書き込む運用にはしません。development版を認定へ提出し、認定済みの版を公開するとliveになります。

1. 最新の`main`をdevelopmentへデプロイする。ASK CLIは`ask deploy --target skill-metadata`でskill packageだけを更新し、LambdaとCloudFormationはSAMで更新する。
2. GitHub Actionsの`Deploy development`が成功し、manifestと対話モデルのFull Buildが完了したことを確認する。
3. developmentシミュレータとEcho実機で上記の認定テストを行う。
4. Privacy & Complianceの5項目、Store掲載内容、プライバシーポリシー公開URLをオーナーが最終確認する。
5. `Deploy development`ワークフローが実行するdevelopment版のValidation結果を確認する。
6. 手動の`Store release`ワークフローで`submit-certification`を選び、確認文字列`SUBMIT`を入力する。公開方法は`MANUAL_PUBLISHING`に固定されるため、認定後の公開日時を別途決定できる。
7. 審査結果を確認し、指摘があれば修正して再申請する。
8. 認定後、`Store release`ワークフローで`publish-certified`を選び、確認文字列`PUBLISH`と必要に応じてUTCの公開日時を入力する。日時を空にすると即時公開になる。

認定提出は外部公開につながる操作です。`ask smapi submit-skill-for-certification`は、オーナーが手順3〜5の完了と公開方法を確認した後にだけ実行します。認定前のコード変更はdevelopmentへ反映し直し、Validationと主要会話フローを再確認します。

## 公式資料

- [スキルマニフェストのスキーマ](https://www.developer.amazon.com/ja-JP/docs/alexa/smapi/skill-manifest.html)
- [子ども向けスキル](https://developer.amazon.com/ja-JP/alexa/alexa-haus/child-directed)
- [スキル認定テスト](https://developer.amazon.com/en-US/docs/alexa/certify-skills/certification-testing.html)
- [ASK CLIコマンドリファレンス](https://www.developer.amazon.com/ja-JP/docs/alexa/smapi/ask-cli-command-reference.html)
- [認定申請と公開](https://www.developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html)
