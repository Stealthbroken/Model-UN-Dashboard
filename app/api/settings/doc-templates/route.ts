import { NextRequest, NextResponse } from "next/server";

import { isDenied, requireSecgen } from "@/lib/auth";
import {
  checkSerializedSize,
  coerceMinutesTemplate,
  coerceTopicGuideTemplate,
  DEFAULT_MINUTES_TEMPLATE,
  DEFAULT_TOPIC_GUIDE_TEMPLATE,
} from "@/lib/doc-templates";
import {
  getDocTemplates,
  resetMinutesTemplate,
  resetTopicGuideTemplate,
  setMinutesTemplate,
  setTopicGuideTemplate,
} from "@/lib/settings";

export async function GET() {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  return NextResponse.json({
    templates: await getDocTemplates(),
    // The UI's "Reset to default" compares against and restores these.
    defaults: {
      topicGuide: DEFAULT_TOPIC_GUIDE_TEMPLATE,
      minutes: DEFAULT_MINUTES_TEMPLATE,
    },
  });
}

/**
 * PATCH — save one or both templates, or reset one to its default.
 * Body: { topicGuide?, minutes?, reset?: "topicGuide" | "minutes" }
 *
 * Everything is run through the coercers first, so a malformed payload becomes
 * a valid template rather than something that breaks Doc generation later.
 */
export async function PATCH(request: NextRequest) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));

  if (data.reset === "topicGuide") {
    await resetTopicGuideTemplate();
    return NextResponse.json({ templates: await getDocTemplates() });
  }
  if (data.reset === "minutes") {
    await resetMinutesTemplate();
    return NextResponse.json({ templates: await getDocTemplates() });
  }
  if (data.reset !== undefined) {
    return NextResponse.json(
      { error: 'reset must be "topicGuide" or "minutes".' },
      { status: 400 },
    );
  }

  let saved = false;

  if (data.topicGuide !== undefined) {
    const template = coerceTopicGuideTemplate(data.topicGuide);
    const size = checkSerializedSize(template);
    if (!size.ok) return NextResponse.json({ error: size.error }, { status: 400 });
    await setTopicGuideTemplate(template);
    saved = true;
  }

  if (data.minutes !== undefined) {
    const template = coerceMinutesTemplate(data.minutes);
    const size = checkSerializedSize(template);
    if (!size.ok) return NextResponse.json({ error: size.error }, { status: 400 });
    await setMinutesTemplate(template);
    saved = true;
  }

  if (!saved) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  return NextResponse.json({ templates: await getDocTemplates() });
}
