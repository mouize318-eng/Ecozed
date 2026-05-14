const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const algerianStates = [
  "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", 
  "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", 
  "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", 
  "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", 
  "Illizi", "Bordj Bou Arreridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued", 
  "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa", 
  "Relizane", "El M'Ghair", "El Menia", "Ouled Djellal", "Bordj Baji Mokhtar", "Béni Abbès", 
  "Timimoun", "Touggourt", "Djanet", "In Salah",   "In Guezzam",
  // "Aflou", "El Abiodh Sidi Cheikh", 
  // "El Aricha", "El Kantara", "Barika", "Bousaâda", "Bir El Ater", "Ksar El Boukhari", 
  // "Ksar Chellala", "Aïn Oussera", "Messaad"
];

async function seedShipping() {
  console.log("Seeding shipping configurations...");

  for (let i = 0; i < algerianStates.length; i++) {
    const code = (i + 1).toString().padStart(2, "0");
    const name = algerianStates[i];

    await prisma.shippingConfig.upsert({
      where: { stateCode: code },
      update: {},
      create: {
        stateCode: code,
        stateName: name,
        homeCost: 600,
        stopDeskCost: 400,
        returnCost: 200,
        changeCost: 300,
      },
    });
  }

  console.log("Shipping configuration seed completed!");
}

seedShipping()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
