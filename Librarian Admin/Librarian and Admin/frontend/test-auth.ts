import { adminRepository } from "./src/lib/admin/repository";

async function test() {
  const result = await adminRepository.authenticate("joseph.tan@stiwnu.edu.ph", "BookHiveLibrarian!2026");
  console.log("Result:", result);
}
test();
