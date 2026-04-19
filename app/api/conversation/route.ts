import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { checkApiLimit, increaseApiLimit } from "@/lib/api-limit";
import { checkSubscription } from "@/lib/subscription";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT =
  "You are a helpful, knowledgeable AI assistant. " +
  "Provide clear, accurate, and concise responses. Be friendly and professional.";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { messages } = body;

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new NextResponse("Anthropic API Key not configured", { status: 500 });
    }

    if (!messages) {
      return new NextResponse("Missing messages", { status: 400 });
    }

    const isAllowed = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!isAllowed && !isPro) {
      return new NextResponse("API Limit Exceeded", { status: 403 });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    if (!isPro) {
      await increaseApiLimit();
    }

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ role: "assistant", content: text }, { status: 200 });
  } catch (error) {
    console.log("[CONVERSATION_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
