import fs from "fs";
import { ExerciseAttributeNameEnum, ExerciseAttributeValueEnum, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

interface FreeExerciseDBEntry {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

// Mapping from free-exercise-db muscles to our enum
const MUSCLE_MAP: Record<string, ExerciseAttributeValueEnum> = {
  abdominals: "ABDOMINALS",
  abductors: "ABDUCTORS",
  adductors: "ADDUCTORS",
  biceps: "BICEPS",
  calves: "CALVES",
  chest: "CHEST",
  forearms: "FOREARMS",
  glutes: "GLUTES",
  hamstrings: "HAMSTRINGS",
  lats: "LATS",
  "lower back": "BACK",
  "middle back": "BACK",
  neck: "NECK",
  quadriceps: "QUADRICEPS",
  shoulders: "SHOULDERS",
  traps: "TRAPS",
  triceps: "TRICEPS",
};

// Mapping from free-exercise-db equipment to our enum
const EQUIPMENT_MAP: Record<string, ExerciseAttributeValueEnum> = {
  bands: "BANDS",
  barbell: "BARBELL",
  "body only": "BODY_ONLY",
  cable: "CABLE",
  dumbbell: "DUMBBELL",
  "e-z curl bar": "EZ_BAR",
  "exercise ball": "SWISS_BALL",
  "foam roll": "FOAM_ROLL",
  kettlebells: "KETTLEBELLS",
  machine: "MACHINE",
  "medicine ball": "MEDICINE_BALL",
  other: "OTHER",
};

// Mapping from free-exercise-db categories to our TYPE enum
const CATEGORY_MAP: Record<string, ExerciseAttributeValueEnum> = {
  cardio: "CARDIO",
  "olympic weightlifting": "WEIGHTLIFTING",
  plyometrics: "PLYOMETRICS",
  powerlifting: "POWERLIFTING",
  strength: "STRENGTH",
  stretching: "STRETCHING",
  strongman: "STRONGMAN",
};

// Mapping from free-exercise-db mechanics to our enum
const MECHANICS_MAP: Record<string, ExerciseAttributeValueEnum> = {
  compound: "COMPOUND",
  isolation: "ISOLATION",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function ensureAttributeNameExists(name: ExerciseAttributeNameEnum) {
  let attributeName = await prisma.exerciseAttributeName.findFirst({
    where: { name },
  });

  if (!attributeName) {
    attributeName = await prisma.exerciseAttributeName.create({
      data: { name },
    });
  }

  return attributeName;
}

async function ensureAttributeValueExists(attributeNameId: string, value: ExerciseAttributeValueEnum) {
  let attributeValue = await prisma.exerciseAttributeValue.findFirst({
    where: {
      attributeNameId,
      value,
    },
  });

  if (!attributeValue) {
    attributeValue = await prisma.exerciseAttributeValue.create({
      data: {
        attributeNameId,
        value,
      },
    });
  }

  return attributeValue;
}

async function createAttribute(exerciseId: string, nameEnum: ExerciseAttributeNameEnum, valueEnum: ExerciseAttributeValueEnum) {
  const attributeName = await ensureAttributeNameExists(nameEnum);
  const attributeValue = await ensureAttributeValueExists(attributeName.id, valueEnum);

  await prisma.exerciseAttribute.create({
    data: {
      exerciseId,
      attributeNameId: attributeName.id,
      attributeValueId: attributeValue.id,
    },
  });
}

async function importExercises(jsonPath: string) {
  const data: FreeExerciseDBEntry[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📋 ${data.length} exercises found in JSON\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of data) {
    try {
      const slug = slugify(entry.name);

      // Check if exercise already exists
      const existing = await prisma.exercise.findFirst({
        where: {
          OR: [{ slug }, { slugEn: slug }],
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Build description from instructions
      const description = entry.instructions.map((inst, i) => `${i + 1}. ${inst}`).join("\n");

      // Get first image URL if available
      const imageUrl = entry.images.length > 0 ? `${IMAGE_BASE_URL}/${entry.images[0]}` : null;

      // Create the exercise
      const exercise = await prisma.exercise.create({
        data: {
          name: entry.name,
          nameEn: entry.name,
          description: description,
          descriptionEn: description,
          fullVideoImageUrl: imageUrl,
          slug: slug,
          slugEn: slug,
        },
      });

      // Add TYPE attribute
      if (entry.category && CATEGORY_MAP[entry.category]) {
        await createAttribute(exercise.id, "TYPE", CATEGORY_MAP[entry.category]);
      }

      // Add PRIMARY_MUSCLE attributes
      const addedPrimaryMuscles = new Set<ExerciseAttributeValueEnum>();
      for (const muscle of entry.primaryMuscles) {
        const mappedMuscle = MUSCLE_MAP[muscle];
        if (mappedMuscle && !addedPrimaryMuscles.has(mappedMuscle)) {
          await createAttribute(exercise.id, "PRIMARY_MUSCLE", mappedMuscle);
          addedPrimaryMuscles.add(mappedMuscle);
        }
      }

      // Add SECONDARY_MUSCLE attributes
      const addedSecondaryMuscles = new Set<ExerciseAttributeValueEnum>();
      for (const muscle of entry.secondaryMuscles) {
        const mappedMuscle = MUSCLE_MAP[muscle];
        if (mappedMuscle && !addedSecondaryMuscles.has(mappedMuscle) && !addedPrimaryMuscles.has(mappedMuscle)) {
          await createAttribute(exercise.id, "SECONDARY_MUSCLE", mappedMuscle);
          addedSecondaryMuscles.add(mappedMuscle);
        }
      }

      // Add EQUIPMENT attribute
      if (entry.equipment && EQUIPMENT_MAP[entry.equipment]) {
        await createAttribute(exercise.id, "EQUIPMENT", EQUIPMENT_MAP[entry.equipment]);
      }

      // Add MECHANICS_TYPE attribute
      if (entry.mechanic && MECHANICS_MAP[entry.mechanic]) {
        await createAttribute(exercise.id, "MECHANICS_TYPE", MECHANICS_MAP[entry.mechanic]);
      }

      imported++;
      if (imported % 50 === 0) {
        console.log(`   ✅ Imported ${imported} exercises...`);
      }
    } catch (error) {
      console.error(`❌ Error importing "${entry.name}":`, error);
      errors++;
    }
  }

  return { imported, skipped, errors };
}

async function main() {
  try {
    console.log("🚀 Import exercises from free-exercise-db...\n");

    const jsonPath = process.argv[2] || "data/free-exercise-db.json";

    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ File not found: ${jsonPath}`);
      process.exit(1);
    }

    console.log(`📁 Importing from: ${jsonPath}\n`);

    const { imported, skipped, errors } = await importExercises(jsonPath);

    console.log("\n📊 Summary:");
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    // Final stats
    const totalExercises = await prisma.exercise.count();
    const totalAttributes = await prisma.exerciseAttribute.count();

    console.log("\n📈 Final database:");
    console.log(`   🏋️  Exercises: ${totalExercises}`);
    console.log(`   🏷️  Attributes: ${totalAttributes}`);

    console.log("\n🎉 Import completed!");
  } catch (error) {
    console.error("💥 Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
