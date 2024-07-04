import { NextResponse } from 'next/server';
import { StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import { ImagesResponse } from 'openai/resources';

import { appConfig } from '@/lib/appconfig';
import { ImageStream } from '@/lib/streams/image-stream';
import { Message, type Usage } from '@/lib/types';
import { chatId } from '@/lib/utils';
import { auth } from '@/server/auth';
import { api } from '@/trpc/server';

export const maxDuration = 60;

function extractContent(res: ImagesResponse) {
  const data = [];

  for (let i = 0; i < res.data.length; i++) {
    const item = res.data[i];

    if (item.url) {
      data.push({
        type: 'image',
        image: item.url
      });
    }

    if (item.b64_json) {
      data.push({
        type: 'image',
        image: `data:image/png;base64,${item.b64_json}`
      });
    }

    if (item.revised_prompt) {
      data.push({
        type: 'text',
        text: item.revised_prompt
      });
    }
  }

  return data;
}

const openai = new OpenAI({
  apiKey: appConfig.openai.apiKey,
  baseURL: appConfig.openai.baseURL
});

type PostData = {
  id?: string;
  title?: string;
  generateId: string;
  messages: Message[];
  usage: Usage;
};

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const json: PostData = await req.json();
  const { title = 'Untitled', messages, generateId, usage } = json;
  const { model, stream, previewToken } = usage;

  if (!openai.apiKey && previewToken) {
    openai.apiKey = previewToken;
  }

  try {
    const prompt = messages[messages.length - 1].content.toString();
    const res = await openai.images.generate({
      model,
      prompt,
      response_format: 'b64_json'
    });

    if (!stream) {
      return NextResponse.json(extractContent(res));
    }

    const aiStream = ImageStream(res, {
      async onCompletion(text) {
        const id = json.id ?? chatId();
        const payload: any = {
          id,
          title,
          messages: [
            ...messages,
            {
              id: generateId,
              content: text,
              role: 'assistant'
            }
          ] as [Message],
          usage: {
            model
          }
        };
        await api.chat.create.mutate(payload);
      }
    });

    return new StreamingTextResponse(aiStream);
  } catch (err: any) {
    if (err instanceof OpenAI.APIError) {
      const status = err.status;
      const error = err.error as Record<string, any>;
      return NextResponse.json({ message: error.message }, { status });
    } else {
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }
}
