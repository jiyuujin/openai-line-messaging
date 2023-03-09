import { APIGatewayProxyHandler } from 'aws-lambda'
import fetch from 'node-fetch'
import * as line from '@line/bot-sdk'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const OPENAPI_CHAT_COMPLETIONS_API = 'https://api.openai.com/v1/chat/completions'
const OPENAPI_SECRET = ''
const LINE_SECRET = ''

export const chatCompletions = async (messages: Message[]): Promise<Message | undefined> => {
  const body = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages,
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

  return data.choices[0].message
};

export const createClient = () => {
  return new line.Client({
    channelAccessToken: LINE_SECRET,
  })
};

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

  try {
    const res = await chatCompletions([{
      role: 'user',
      content: reqBody.events[0].message.text,
    }])

    const client = createClient()
    await client.pushMessage(reqBody.events[0].source.userId, {
      type: 'text',
      text: res.content,
    })

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          response_type: 'in_channel',
          text: res.content,
        },
        null,
        2,
      ),
    }
  } catch (err) {
    return {
      statusCode: 401,
      body: JSON.stringify(
        {
          response_type: 'in_channel',
          text: err || 'Something is wrong.',
        },
        null,
        2,
      ),
    }
  }
}
