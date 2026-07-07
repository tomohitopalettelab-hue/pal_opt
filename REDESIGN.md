# Pal Opt 再設計書 — AIO（AI検索最適化）× レポート観測サービス

作成日: 2026-07-07 / ステータス: ドラフト（承認待ち）

旧Pal Opt（SNS自動投稿サービス）を完全に作り直し、**AIO（AI Optimization / 生成AI検索最適化）を軸に、MEO・SEOの観測も統合したサービス**として再構築する。

---

## 1. AIOとは何か・どう観測するか（前提知識）

### 1-1. 用語整理
- **AIO / LLMO / GEO / AEO** はほぼ同義。「ChatGPT・Gemini・Perplexity・GoogleのAI Overview（AIによる概要）などの**AI回答の中で、自社が言及・引用・推薦される状態**を作る施策」を指す。
- 従来SEOとの違い: SEOは「検索結果で上位に**表示される**こと」、AIOは「AIの回答文の中で**名前が挙がる／情報源として引用される**こと」がゴール。順位ではなく**引用**を競う。

### 1-2. 観測の仕組み（商用ツールの実態 = 自作可能）
Profound・Peec AI・Otterly等の海外ツール、国内のミエルカGEO等は、全て同じ方式:

1. **プロンプト定点観測**: 顧客の商圏・業種から「想定される質問」（例:「渋谷でおすすめの美容室は？」「◯◯業界の勤怠管理システムでおすすめは？」）を20〜50個用意
2. それを**毎日/毎週、各AIエンジンのAPIに機械的に投げる**
3. 回答を解析して記録: **自社の言及有無・言及順位・引用URL・競合の言及・センチメント（好意的か）**
4. 時系列でスコア化してダッシュボード表示

→ つまり中核は「**LLM APIを叩いて回答をLLMで解析するバッチ**」であり、palette_systemの既存技術（OpenAI SDK + Neon + cron）でそのまま自作できる。

### 1-3. 観測対象エンジンと取得手段
| エンジン | 取得手段 | 備考 |
|---|---|---|
| ChatGPT（検索あり） | OpenAI API（web_search tool付き） | 最重要。国内利用者最多 |
| Google AI Overview / AIモード | **DataForSEO SERP API**（$0.6〜2/1,000クエリ） | 通常のSEO順位も**同じAPIで同時取得**できる |
| Perplexity | Perplexity API（sonar） | 引用URLが構造化されて返る |
| Gemini | Google AI API（Google Search grounding） | |
| Googleマップ（MEO） | DataForSEO Local/Maps API + Google Business Profile API | GBP APIは利用承認申請が必要（旧Pal Optで**連携実装済み・流用可**） |

### 1-4. どうしたらAIに引用されるか（施策側の要点）
2026年5月にGoogleが初の公式ガイドを公開。要点:
- **基本は良質なSEOと同じ**（クロール可能・質の高いコンテンツ）。魔法の裏技はない
- **llms.txtはGoogleは使っていない**（他エンジン向けに置くのは低コストなので任意）
- 効くのは: **構造化データ（schema.org JSON-LD）**、結論先出しのQ&A構造、一次情報・統計・具体的数値、更新日の明示、**AIクローラーをrobots.txtでブロックしない**（GPTBot / OAI-SearchBot / PerplexityBot / ClaudeBot / Google-Extended）
- **第三者からの言及**（口コミ・比較サイト・地域メディア）をAIは引用しがち → **MEO・口コミ強化がそのままAIO施策になる**（Pal Trustとの相乗り）
- Princeton研究（KDD 2024）: 構造最適化でAI回答内の可視性が最大40%向上

---

## 2. サービスコンセプト

> **「あなたのお店・会社が、AIにどう答えられているかを見える化し、AIに選ばれる状態を作る」**

3本柱:
1. **観測（Visibility）** — AI回答での言及・引用を定点観測し、AI可視性スコアとして見える化。SEO順位・MEO順位も同時観測
2. **診断（Audit）** — 顧客サイトを自動診断し「AIOスコア」を算出（構造化データ・AIクローラー許可・コンテンツ構造など約30項目）
3. **改善（Action）** — 観測＋診断から改善タスクをAIが自動生成。JSON-LD生成・FAQ案・GBP投稿/口コミ返信（旧機能流用）・月次レポート

### プラン【2026-07-07 決定: プロプラン一本化】
- 「観測のみ」プラン（旧lite構想）は**提供しない**
- **プロプラン（Pal Opt Pro）一本**: 旧standard構想の全機能（日次計測・全エンジン・プロンプト50個・競合比較・サイト診断・改善タスク・MEO/GBP運用）に **Pal Studio（サイト制作・運用）をセット**にした AIO×SEO×MEO 統合商品
- Studioが付くことで改善施策は「納品して顧客が実装」ではなく**「こちらで実装まで完結」が基本**になる（下記提供モデル参照）
- サービスキー: 新コード `pal_opt_pro` を service_plans に追加し、serviceKeys で pal_opt＋pal_studio 両方の利用権限を解放する形を想定（crm_contracts 側の正規化ルールは実装時に palette_crm proxy を確認）。旧 `pal_opt`/`pal_opt_lite`/`pal_opt_standard` キーは互換参照のみ残す
- 無料簡易診断（初回レポートの簡易版）は**営業導線**として残す（商品ではなくリード獲得ツール）

### 提供モデル【2026-07-07 改訂: プロプラン＝Studio込みで「実装まで完結」】
プロプランはPal Studioを含むため、改善施策の実装をこちら側でコントロールできるのが前提。顧客の状態で2ルート:

- **HPなし / 作り直したい顧客**: **StudioでAIO対応サイトを新規制作**（構造化データ・Q&A構造・更新運用を最初から組み込み）＋GBP開設。実装コントロール100%
- **既存HPを残したい顧客**: 既存HPはそのまま、**Studioで「AI最適化コンテンツハブ」（ブログ/FAQ/特集ページ）を追加構築**し、そこを施策の受け皿にする。既存HP側への軽微な変更（JSON-LD・robots.txt）はコピペキット納品 or GTM注入 or 代行で補完

**HPに触れなくても効くレバーも併用**: AI回答は第三者ソース（口コミ・GBP・比較/地域メディア）を引用しがち → GBP整備・口コミ強化（Pal Trust相乗り）・サイテーション獲得はHP編集不要でAIO効果が大きい。

**GBP**: 既存GBPは管理者招待で運用代行、未開設なら開設代行込み（プロプラン標準）。

→ onboarding時に `pal_opt_projects` へ「サイト方針（Studio新規制作/既存HP＋Studioハブ併設）」と「既存HPの編集手段（WP/GTM/制作会社/不可）」を記録し、改善タスクの出し分け（Studio側で自動実装/コピペキット/代行）に使う。

### コスト概算（1顧客/月）
- **MVP無料構成**: Gemini無料枠＋gpt-4o-mini＋GSC/Places/GBP無料API → **月数十円レベル**（詳細は「6. 外部API構成」）
- **DataForSEO増強後**: ＋AI Overview/競合順位/MEO精密計測で **月数百円〜1,500円程度**
→ いずれもプロプラン価格に対して原価は誤差レベル。

---

### サービス内容（顧客視点・既存HP顧客の標準パッケージ）【2026-07-07 追記】
例: 渋谷の美容室

**① 契約直後（初期セットアップ・1回）**
- ヒアリング: 商圏・強みメニュー・競合3〜5社を登録
- AIが「お客さんがAIに聞きそうな質問」50個を自動生成（認知/比較/地域/購買）→ 管理者調整で確定
- 初回レポート「今、AIはあなたをこう答えている」: 実際のAI回答原文＋AIOスコア診断。**営業ツールとしても機能**（「ChatGPTで競合が推薦され、御社は出てこない」が導入動機になる）

**② 日々（自動）**: 定点計測＋SEO/MEO順位＋変化通知（「ChatGPTで紹介されるようになりました」等）

**③ いつでも（ダッシュボード）**: スコア推移・競合SoV・順位・**AI回答の実物ログ**（最重要画面）

**④ 毎月（レポート＋改善実装）**: 月次レポート＋改善タスク3〜5個。プロプランはStudio込みのため**実装まで完結**が基本:
- Studio管理サイト（新規制作 or 併設コンテンツハブ）への実装: FAQ/特集ページ追加・構造化データ・更新運用
- 既存HP側に必要な軽微変更: JSON-LD完成コード（貼るだけ／GTM注入）・robots.txt修正指示・改修指示書
- GBP投稿・口コミ返信・情報整備（運用代行）
実装後は次回計測で自動検知し「FAQ追加後、言及率12%→28%」のように**効果を数字で閉じる**。

**提供物の一言定義**: 「AIにどう見られているかの継続レポート」＋「Studioでの施策実装（サイト制作/コンテンツハブ）」＋「GBP・口コミの運用代行」＝AIO×SEO×MEOの統合運用。

## 3. アーキテクチャ

### 3-1. 全体構成（palette_systemの慣習に準拠）
- **Next.js 16 / React 19 / Tailwind v4 / App Router**（旧と同じ、ただし巨大単一ファイルを廃止しルート分割）
- ポート **3104**、Vercelプロジェクト **pal-opt** を継続（console iframe・pal_agencyの`service-ports.ts`参照を壊さない）
- 認証: **pal_db proxy `/api/verify-chat-login`**（scrypt照合）+ **HMAC署名Cookie（pal_agencyの`cookie-sign.ts`方式・`SESSION_SECRET`）** ← 旧の無署名Cookieから改善
- 契約判定: `GET /api/palette-services?paletteId=` の serviceKeys で `pal_opt*` を確認
- APIはdefault-deny（セッション or サービスキー必須。security_hardening方針に準拠）

### 3-2. 計測パイプライン
```
[GitHub Actions cron（palette_crm alerts方式・CRON_SECRET）]
   ↓ 日次/週次
POST /api/cron/collect   … プロンプト実行キューを小バッチ（20件）で同期処理
   ├─ OpenAI (web_search) ─┐
   ├─ Perplexity API      ─┤→ 回答テキスト
   ├─ Gemini (grounding)  ─┘
   └─ DataForSEO（AI Overview / SEO順位 / MEOローカル順位）
   ↓
POST /api/cron/analyze   … 軽量LLMで回答を解析
   （自社言及有無・言及順、競合言及、引用URL、センチメント）→ pal_opt_runs に保存
   ↓
スコア集計（日次スナップショット）→ ダッシュボード / 月次レポート
```
- Vercelサーバレスのタイムアウト対策は palette_crm のURL巡回監視と同じ「**同期＋小バッチ＋cron側で複数回叩く**」方式
- 予約・常駐処理を**pal_db(Render)に依存しない**構成にする（旧の`pal-opt-scheduler`依存を解消）

### 3-3. DBスキーマ（同一Neon・`pal_opt_` プレフィックス刷新）
| テーブル | 役割 |
|---|---|
| `pal_opt_projects` | 顧客ごとの観測設定（palette_id, site_url, 業種, 商圏, 競合リストjsonb, プラン） |
| `pal_opt_prompts` | 観測プロンプト（text, カテゴリ=認知/比較/地域/購買, 対象エンジン[], active）。AIが業種×商圏から自動提案 |
| `pal_opt_runs` | 計測結果1回分（prompt_id, engine, executed_at, 回答全文, brand_mentioned, mention_position, sentiment, citations jsonb, competitors jsonb） |
| `pal_opt_keywords` / `pal_opt_serp_runs` | SEO/MEOキーワードと順位履歴（rank, aio_present, aio_cited, map_rank） |
| `pal_opt_audits` | サイト診断結果（score, checks jsonb, 実行日時） |
| `pal_opt_actions` | 改善タスク（提案内容, 種別=構造化データ/FAQ/GBP/コンテンツ, status） |
| `pal_opt_reports` | 月次レポートスナップショット |

※ 旧テーブル（`pal_opt_settings`/`pal_opt_posts`/`pal_opt_templates`/`pal_opt_plans`）は他アプリから共有参照されているため、扱いは「7. 旧機能の扱い」の決定後に確定。

### 3-4. 主要指標（ダッシュボードの数字）
- **AI可視性スコア**: 言及率（言及された計測回数÷全計測）をエンジン横断で加重平均
- **言及順位**: 回答内で何番目に名前が出るか
- **引用率**: 自社ドメインが情報源としてリンクされた割合
- **Share of Voice**: 自社言及 ÷（自社＋競合の言及合計）
- **センチメント**: 好意的/中立/否定的
- **AIOスコア**: サイト診断30項目の達成度
- SEO順位・MEO順位（従来型指標）

---

## 4. 画面構成

### 顧客向け（/main → 分割ルート化）
1. **ダッシュボード** — AI可視性スコア・推移グラフ・エンジン別内訳・今週のハイライト（「ChatGPTで◯◯と紹介されました」の実回答サンプル）
2. **AI回答ログ** — 実際のAI回答全文と引用元URL（「AIがうちをこう説明している」が最大の提供価値）
3. **競合比較** — Share of Voice、競合の言及回数比較
4. **順位観測** — SEO順位・MEO順位・AI Overview掲載状況の一覧
5. **サイト診断** — AIOスコアとチェック項目（◯✕と改善方法の説明）
6. **改善タスク** — AIが生成した施策リスト（JSON-LDコピペコード、FAQ文案など成果物付き）
7. **レポート** — 月次レポート閲覧/PDF

### 管理者向け（/admin）
- 顧客プロジェクト管理・プロンプト初期設定（AI提案→人が承認）・計測実行状況/失敗監視・APIコスト監視・レポート承認

### UI
- 旧Pal Optのパープル系（アクセント`#A62183`）を継承しつつ、pal_trustのレポート画面（`app/reports/page.tsx`）のカード構成を参考にする
- 巨大単一ファイル（旧main 2,525行/admin 2,375行）は廃止し、ルート/コンポーネント分割

---

## 5. 開発ロードマップ

- **Phase 0: 旧機能の依存整理** ✅完了(2026-07-07)
- **Phase 1 (MVP・無料構成)** ✅完了(2026-07-07・本番稼働): プロジェクト設定・プロンプト自動提案・**Gemini(無料枠grounding)＋ChatGPT(検索なし)の2エンジン計測**・解析・ダッシュボード・AI回答ログ・認証(HMAC化)。cronはGitHub ActionsでなくVercel Cron採用(毎日3時JST・CRON_SECRET自動Bearer)
- **Phase 2（診断＋改善）** ✅完了(2026-07-07・本番稼働): サイト診断（AIOスコア約20項目・週次自動）・改善タスク自動生成（LocalBusiness JSON-LD/robots修正/**言及されなかった質問に答えるFAQ文案+FAQPage構造化データ**/コンテンツ施策）・実装ステータス管理（実装済み→言及率推移で効果検証）
- **Phase 2.5（無料範囲の全実装）** ✅完了(2026-07-08・本番稼働): 競合Share of Voice（ダッシュボード+レポート）・月次レポート（/main/report・前月比・引用元ドメイン一覧・印刷/PDF）・管理者画面（/admin・顧客横断の計測状況/エラー監視）・**Google連携=GSC(SEO実測)+GBP(MEO/口コミ)**（旧OAuthクライアント/リダイレクトURI流用・/main/connect→/main/seo）
- **未実装（有料 or 大型）**: DataForSEO(AI Overview・競合順位・MEO精密順位/有料)・GBP書き込み系(投稿・口コミ返信の実行)・Pal Studio自動実装(Phase 4)・Pal Trust連携再接続。**Gemini無料枠は接地20〜30件/日で429** → 顧客増加前にGoogleプロジェクトの課金有効化（有効化後もgrounding 1,500件/日まで無料）
- **Phase 3**: MEO統合（GBP OAuth流用・口コミ・ローカル順位）・改善タスク自動生成・月次レポートPDF
- **Phase 4**: 施策実行支援（JSON-LD生成・FAQ案・GBP投稿/口コミ返信の自動化）・Pal Trust口コミ連携の再接続・**Pal Studio連携**（改善タスク→Studio管理サイトへの自動実装。AIがFAQ/コンテンツを生成しStudio側に直接反映するパイプライン。競合ツールにない差別化ポイント）

---

## 6. 外部API構成【2026-07-07 決定: MVPは無料構成で開始】

### MVP（無料構成）— 原価: 顧客あたり月数十円レベル
| 対象 | 手段 | 備考 |
|---|---|---|
| Gemini計測 | **Gemini API無料枠**（Flash系・Google Search grounding込み） | 検索接地ありの無料主力エンジン。無料件数上限は実装時に最新料金表で確認 |
| ChatGPT計測 | gpt-4o-mini・**検索なし**（既存 `OPENAI_KEY_API`） | 1回1円未満。「素のモデル知識での言及」を指標化 |
| SEO | **Google Search Console API（無料・公式）** | 顧客OAuth連携。実測の掲載順位/表示回数/クエリ。競合順位は取れない |
| MEO | **Places API無料枠**（順位近似）＋ **GBP API（無料・承認済み）** | 口コミ/投稿/インサイト。無料SKU上限は実装時確認 |
| AI Overview | 当面対象外（or SerpApi無料枠100件/月で主要KWのみ月次） | |
| 回答解析 | gpt-4o-mini | |
| サイト診断 | 自前クロール | 元から無料 |

※ 自前のGoogle SERPスクレイピングはToS違反・CAPTCHA・IPブロックで保守コスト過大のため**採用しない**。

### 受注後の増強（有料・任意）
- **DataForSEO**（従量 $0.6〜2/1,000、デポジット$50〜）: AI Overview/AIモード監視・競合SEO順位・MEO精密順位を追加。原価は顧客あたり月数百円 → プロプラン売上1件で回収可
- **Perplexity API**: エンジン追加（優先度低。国内利用者はChatGPT/Gemini中心）
- OpenAI web_search付き計測（「検索を使うChatGPT」の再現度向上）

GSC/GBP/PlacesのGoogle OAuth実装は有料API導入後も無駄にならない（GSC実測データは併用価値あり）。GBP APIの承認・GCP OAuthクライアントは旧Pal Optの資産を流用。

---

## 7. 【決定済 2026-07-07】旧Pal Opt（SNS自動投稿）の扱い = 完全リセット

旧Pal Optは**一旦完全リセット**し、新Pal Opt（AIO）をゼロから作る（ユーザー決定）。
旧Pal Optは以下から共有参照されているため、Phase 0 で同時に手当てする:

| 参照元 | 参照内容 | Phase 0 での対応 |
|---|---|---|
| pal_trust | `review-to-sns`（口コミ→SNS投稿を`pal_opt_posts`へ直接作成）、`gbp-reviews`（`pal_opt_settings`からGBP認証取得）、admin画面の連携UI | 機能を撤去または無効化（フラグでOFF） |
| palette_console | 「Pal Opt 分析」ページ（投稿データ集計）、iframe埋め込み・サービスキー表示 | 分析ページ撤去。iframe/サービスキーは新Pal Optで継続 |
| pal_db (Render) | node-cron `pal-opt-scheduler.ts` が毎分 `pal_opt_posts` を監視して予約投稿 | scheduler/publisher の起動を停止 |

### Phase 0 作業手順（安全な削除順序）
1. pal_db(Render) の pal-opt-scheduler を停止（`index.ts` の `startScheduler()` 呼び出し除去→デプロイ）
2. pal_trust の review-to-sns / gbp-reviews のpal_opt依存を無効化
3. palette_console の Pal Opt 分析ページを撤去
4. 旧テーブルは即DROPせず `legacy_pal_opt_*` にリネームして退避（顧客の過去投稿データ保全。一定期間後にDROP）
5. `pal_opt/` のコードを全削除し、新雛形（Next.js 16・HMAC認証・分割ルート）を構築
6. Vercel env（IG/X/GBPトークン類）の棚卸し。GBP OAuthのクレデンシャルはPhase 3のMEO機能で再利用する可能性があるため記録して保管

※ GBP連携（投稿・口コミ返信）は旧コードからの「移植」ではなく、Phase 3 で新規実装し直す（GCP側のOAuthクライアント・API承認は流用可）。
