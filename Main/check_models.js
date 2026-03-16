async function checkModel(repo) {
  const res = await fetch(`https://huggingface.co/api/models/${repo}`);
  if(res.ok) console.log(repo + " exists");
  else console.log(repo + " NOT found");
}
const langs = ['es','fr','de','it','pt','hi','ar','zh','ja','ko','ru'];
async function run() {
  for(let l of langs) {
    await checkModel(`Xenova/opus-mt-en-${l}`);
  }
}
run();
