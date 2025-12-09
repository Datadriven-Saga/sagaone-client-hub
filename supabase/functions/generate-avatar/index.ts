import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AvatarOptions {
  gender: "male" | "female";
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  hasBeard: boolean;
  beardStyle?: string;
  hasGlasses: boolean;
  glassesStyle?: string;
  faceShape: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const options: AvatarOptions = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt for avatar generation
    const genderText = options.gender === "male" ? "homem" : "mulher";
    const skinToneMap: Record<string, string> = {
      "light": "pele clara",
      "medium-light": "pele morena clara",
      "medium": "pele morena",
      "medium-dark": "pele morena escura",
      "dark": "pele negra",
    };
    const skinText = skinToneMap[options.skinTone] || "pele média";

    const hairStyleMap: Record<string, string> = {
      "short": "cabelo curto",
      "medium": "cabelo médio",
      "long": "cabelo longo",
      "curly": "cabelo cacheado",
      "wavy": "cabelo ondulado",
      "bald": "careca",
      "buzz": "cabelo raspado",
    };
    const hairText = hairStyleMap[options.hairStyle] || "cabelo curto";

    const hairColorMap: Record<string, string> = {
      "black": "cabelo preto",
      "brown": "cabelo castanho",
      "blonde": "cabelo loiro",
      "red": "cabelo ruivo",
      "gray": "cabelo grisalho",
      "white": "cabelo branco",
    };
    const hairColorText = options.hairStyle === "bald" ? "" : hairColorMap[options.hairColor] || "cabelo castanho";

    const faceShapeMap: Record<string, string> = {
      "oval": "rosto oval",
      "round": "rosto redondo",
      "square": "rosto quadrado",
      "heart": "rosto em formato de coração",
      "oblong": "rosto alongado",
    };
    const faceText = faceShapeMap[options.faceShape] || "rosto oval";

    let extraFeatures = "";
    if (options.hasBeard && options.gender === "male") {
      const beardMap: Record<string, string> = {
        "stubble": "barba por fazer",
        "short": "barba curta",
        "full": "barba cheia",
        "goatee": "cavanhaque",
        "mustache": "bigode",
      };
      extraFeatures += `, ${beardMap[options.beardStyle || "short"] || "barba curta"}`;
    }

    if (options.hasGlasses) {
      const glassesMap: Record<string, string> = {
        "round": "óculos redondos",
        "square": "óculos quadrados",
        "aviator": "óculos aviador",
        "cat-eye": "óculos gatinho",
        "rimless": "óculos sem aro",
      };
      extraFeatures += `, ${glassesMap[options.glassesStyle || "square"] || "óculos"}`;
    }

    const prompt = `Create a professional 3D Pixar-style avatar portrait of a ${genderText} with ${skinText}, ${faceText}, ${hairText}${hairColorText ? `, ${hairColorText}` : ""}${extraFeatures}. 
The avatar should be:
- High quality 3D render in Pixar/Disney animation style
- Head and shoulders portrait only
- Neutral/friendly expression
- Clean solid color background (light gray or soft blue)
- Professional and suitable for a business profile
- Square aspect ratio 1:1
- Ultra high resolution`;

    console.log("Generating avatar with prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the image from the response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating avatar:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
