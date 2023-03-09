---
title: "ChatGPT (OpenAI) を AWS Lambda / LINE チャット上で動かす"
emoji: "🐍"
type: "tech"
topics: ["chatgpt", "line", "linebot", "openai", "aws"]
published: true
---

## ChatGPT を Slack へ組み込む

先日、ブログを書きました。

https://blog.nekohack.me/posts/chatgpt-slack

詳細はこのブログをご確認いただくとしながらも、ポイントは Lambda の Function 内で [Chat completions](https://platform.openai.com/docs/guides/chat/chat-completions-beta) を実行することになります。

Slack より入力したものをリクエストパラメータとして受け取れたら、その準備が整います。

その際、先に作成した OpenAI の secret キーを読み込みます。

```ts
import fetch from 'node-fetch'

const OPENAPI_CHAT_COMPLETIONS_API = 'https://api.openai.com/v1/chat/completions'

// OpenAI の secret キーを設定します
const OPENAPI_SECRET = ''

const body = JSON.stringify({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: '日本の首都って何だっけ？',
    },
  ],
})

const res = await fetch(OPENAPI_CHAT_COMPLETIONS_API, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAPI_SECRET}`,
  },
  body,
})
const data = await res.json()
console.log('🚀 ~ file: chatgpt-line-messaging.md:45 ~ data:', data)
```

## ChatGPT を LINE チャットへ組み込む

Slack へ組み込めば、LINE チャットへの組み込みも、そこまで難しいものではありません。

### Messaging API の作成

基本的には LINE Developers の [公式ガイド](https://developers.line.biz/ja/docs/messaging-api/getting-started/) を見て Messaging API の作成を進めていただければ、と考えています。

https://developers.line.biz/ja/docs/messaging-api/getting-started/

ざっくりいうと、やることは LINE Developer Console 上で Messaging API を作成することとなります。

チャネルアプリを作成すると、チャネル基本設定の右に Messaging API 設定があります。

この Messaging API 設定では、下記 2 点設定してください。

- よりチャネルアクセストークンを発行、確認する
- Webhook URL を設定する

ここで、自動的に有効化される応答メッセージについては、このタイミングに無効化します。

なお、後者については AWS Lambda へのデプロイが完了した後に Webhook URL を設定しましょう。

### Lambda における Message Function の作成

LINE チャットで入力したメッセージは `reqBody.events[0].message.text` より受け取れます。

```ts
const reqBody = JSON.parse(event.body)
console.log('🚀 ~ file: chatgpt-line-messaging.md:80 ~ reqBody.events[0].message.text:', reqBody.events[0].message.text)
```

LINE チャット内で bot アカウントを使用するため [`@line/bot-sdk`](https://www.npmjs.com/package/@line/bot-sdk) を利用します。

https://www.npmjs.com/package/@line/bot-sdk

LINE Developer Console の Messaging API 設定で作成した secret キーと合わせて `line.Client()` を使用しましょう。

その際、ユーザー ID は `reqBody.events[0].source.userId` より受け取れます。

このユーザー ID に対し `line.pushMessage()` を使用することで bot アカウントによる LINE チャットへ返信を実現できます。

```ts
import { APIGatewayProxyHandler } from 'aws-lambda'
import * as line from '@line/bot-sdk'

// LINE Developer Console で作成した secret キーを設定します
const LINE_SECRET = ''

export const hello: APIGatewayProxyHandler = async (event) => {
  await new line.Client({
    channelAccessToken: LINE_SECRET,
  })
    .pushMessage(reqBody.events[0].source.userId, {
      type: 'text',
      text: res.content,
    })
}
```

そして `npx sls deploy` を実行、LINE チャットで確認しましょう。

![](https://i.imgur.com/pSYSi2C.jpg)

このように、ちゃんと返答してくれたら OK となります。

その詳細については、下記コミットログをご確認いただければ。

https://github.com/jiyuujin/openai-line-messaging/commit/ac8ca968aa2d09b3437a582991c3069286ceb18a

## 文字列以外の入力を考慮する

`reqBody.events[0].message.type` より、LINE チャットで入力されたものがメッセージか、そうで無いかを判定できます。

```ts
import { APIGatewayProxyHandler } from 'aws-lambda'

export const hello: APIGatewayProxyHandler = async (event) => {
  const reqBody = JSON.parse(event.body)

  if (reqBody.events[0].message.type !== 'text') {
    return {
      statusCode: 401,
      body: JSON.stringify(
        {
          response_type: 'in_channel',
          text: 'Please input text.',
        },
        null,
        2,
      ),
    }
  }
}
```

あとは、このソースコードを下に、色々 ChatGPT と遊べそうな気がします。
