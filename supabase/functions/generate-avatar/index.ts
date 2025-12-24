import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
const allowedOrigins = [
  'https://automatemaia.sagadatadriven.com.br',
  'https://lovable.dev',
  'https://id-preview--c4cc9f7d-5d60-4beb-ad66-04c36f0ace7c.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '')) || origin === allowed);
  
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

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
  clothingColor: string;
  backgroundColor: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let prompt: string;
    let messages: any[];

    // Check if generating from photo or from options
    if (body.generateFromPhoto && body.sourceImage) {
      // Generate Pixar-style avatar from uploaded photo
      prompt = `Transform this person's photo into a high-quality 3D Pixar/Disney animation style avatar portrait. 
Keep the person's recognizable features (face shape, skin tone, hair style, hair color, any glasses, facial hair if present) but render them in the iconic Pixar 3D animation style.
The avatar should be:
- High quality 3D render in Pixar/Disney animation style
- Head and shoulders portrait only
- Friendly, approachable expression similar to the original photo
- Solid light gray background (#e5e7eb)
- Professional and suitable for a business profile
- Square aspect ratio 1:1
- Ultra high resolution
Maintain the person's identity and distinctive features while applying the animated style.`;

      messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: body.sourceImage,
              },
            },
          ],
        },
      ];
    } else {
      // Generate from options (original flow)
      const options: AvatarOptions = body;
      
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

      const clothingColorMap: Record<string, string> = {
        "navy": "roupa azul marinho",
        "black": "roupa preta",
        "white": "roupa branca",
        "gray": "roupa cinza",
        "blue": "roupa azul",
        "green": "roupa verde",
        "red": "roupa vermelha",
        "purple": "roupa roxa",
      };
      const clothingText = clothingColorMap[options.clothingColor] || "roupa azul marinho";

      const backgroundColorMap: Record<string, string> = {
        "light-gray": "fundo cinza claro sólido",
        "light-blue": "fundo azul claro sólido",
        "white": "fundo branco sólido",
        "light-green": "fundo verde claro sólido",
        "light-yellow": "fundo amarelo claro sólido",
        "light-purple": "fundo roxo claro sólido",
        "navy": "fundo azul marinho sólido",
        "dark": "fundo cinza escuro sólido",
      };
      const backgroundText = backgroundColorMap[options.backgroundColor] || "fundo cinza claro sólido";

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

      prompt = `Create a professional 3D Pixar-style avatar portrait of a ${genderText} with ${skinText}, ${faceText}, ${hairText}${hairColorText ? `, ${hairColorText}` : ""}${extraFeatures}, wearing ${clothingText}. 
The avatar should be:
- High quality 3D render in Pixar/Disney animation style
- Head and shoulders portrait only
- Neutral/friendly expression
- ${backgroundText}
- Professional and suitable for a business profile
- Square aspect ratio 1:1
- Ultra high resolution`;

      messages = [
        {
          role: "user",
          content: prompt,
        },
      ];
    }

    console.log("Generating avatar with prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages,
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
