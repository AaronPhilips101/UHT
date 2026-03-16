async function checkModel(repo) {
  const res = await fetch(`https://huggingface.co/api/models/${repo}`);
  if(res.ok) console.log(repo + " exists");
}
const repos = [
  'Xenova/opus-mt-en-pt', 'Xenova/opus-mt-tc-big-en-pt', 'Xenova/opus-mt-en-ROMANCE',
  'Xenova/opus-mt-en-jap', 'Xenova/opus-mt-en-ja',
  'Xenova/opus-mt-en-ko', 'Xenova/opus-mt-tc-big-en-ko'
];
async function run() {
  for(let r of repos) {
    await checkModel(r);
  }
}
run();
