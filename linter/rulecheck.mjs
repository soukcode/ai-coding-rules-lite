#!/usr/bin/env node
/** Souk Code rulecheck. Zero dependencies. Node 22+. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export const packRoot=path.resolve(here,'..');
const skip=new Set(['node_modules','.git','.next','vendor','dist','coverage']);
export function walk(root,prefix='') {
 const result=[];if(!fs.existsSync(root))return result;
 for(const e of fs.readdirSync(root,{withFileTypes:true})) {
  if(skip.has(e.name)||e.isSymbolicLink())continue;
  const rel=prefix?prefix+'/'+e.name:e.name,abs=path.join(root,e.name);
  if(e.isDirectory())result.push(...walk(abs,rel));else if(e.isFile())result.push(rel);
 }return result.sort();
}
export function parseFrontmatter(text) {
 const lines=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').split('\n');
 if(lines[0]!=='---')throw new Error('Missing opening ---');
 const end=lines.indexOf('---',1);if(end<0)throw new Error('Missing closing ---');
 const data={};
 for(const line of lines.slice(1,end)) {
  if(!line.trim()||line.trim().startsWith('#'))continue;
  const m=line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/);if(!m)throw new Error('Unsupported frontmatter syntax; use flat key: value fields');
  const [,key,raw]=m;if(Object.hasOwn(data,key))throw new Error('Duplicate frontmatter key: '+key);
  if(raw==='true'||raw==='false')data[key]=raw==='true';
  else if(raw.startsWith('"')){try{data[key]=JSON.parse(raw);}catch{throw new Error('Invalid quoted scalar: '+key);}}
  else if(raw.startsWith("'")){if(!raw.endsWith("'")||raw.length<2)throw new Error('Unclosed scalar: '+key);data[key]=raw.slice(1,-1).replace(/''/g,"'");}
  else if(raw.startsWith('[')||raw.startsWith('{')||/[|>]/.test(raw))throw new Error('Unsupported YAML construct: '+key+'; use a quoted scalar');
  else data[key]=raw;
 }
 return {data,body:lines.slice(end+1).join('\n')};
}
export function globRegex(glob) {
 if(typeof glob!=='string'||!glob||glob.includes('..')||glob.startsWith('/')||glob.includes('\\')||/[{}\[\]!]/.test(glob))throw new Error('Unsupported or unsafe glob: '+glob);
 let s='^';for(let i=0;i<glob.length;i++){
  const c=glob[i];if(c==='*') {if(glob[i+1]==='*'){i++;if(glob[i+1]==='/'){i++;s+='(?:.*/)?';}else s+='.*';}else s+='[^/]*';}
  else if(c==='?')s+='[^/]';else s+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 }return new RegExp(s+'$');
}
function readJson(file) {return JSON.parse(fs.readFileSync(file,'utf8'));}
export function detectStack(root) {
 const found=[];const composer=path.join(root,'composer.json'),pkg=path.join(root,'package.json');
 if(fs.existsSync(composer)){const c=readJson(composer);if(c.require?.['laravel/framework']||c['require-dev']?.['laravel/framework'])found.push('laravel');}
 if(fs.existsSync(pkg)){const p=readJson(pkg);if(p.dependencies?.next||p.devDependencies?.next)found.push('nextjs-ts');}
 return found;
}
export function validate(root,{stack,strictGlobs=false,maxBytes=16000}={}) {
 root=path.resolve(root);const issues=[],files=walk(root),rules=[],ids=new Map();
 const add=(level,code,file,message)=>issues.push({level,code,file,message});
 let detected=[];try{detected=detectStack(root);}catch(e){add('error','MANIFEST','',e.message);}
 if(stack&&!['laravel','nextjs-ts'].includes(stack))add('error','STACK','', 'Unknown stack '+stack);
 if(stack&&detected.length&&!detected.includes(stack))add('error','WRONG_STACK','',`Expected ${stack}; detected ${detected.join(', ')}`);
 if(!stack&&!detected.length)add('warning','UNKNOWN_STACK','','No Laravel or Next.js dependency detected; use --stack for an instruction-only folder');
 for(const name of ['CLAUDE.md','AGENTS.md']){
  const abs=path.join(root,name);if(!fs.existsSync(abs)){add('error','MISSING_WRAPPER',name,'Required wrapper missing');continue;}
  const st=fs.lstatSync(abs);if(st.isSymbolicLink()||!st.isFile()){add('error','UNSAFE_FILE',name,'Expected a regular non-symlink file');continue;}
  const text=fs.readFileSync(abs,'utf8');if(!text.trim())add('error','EMPTY_FILE',name,'Wrapper is empty');if(Buffer.byteLength(text)>maxBytes)add('warning','SIZE',name,'Instruction file exceeds configured byte budget');
 }
 const ruleFiles=files.filter(f=>f.startsWith('.cursor/rules/')&&f.endsWith('.mdc'));
 if(!ruleFiles.length)add('error','NO_RULES','.cursor/rules','No .mdc rules found');
 for(const file of ruleFiles){
  const text=fs.readFileSync(path.join(root,file),'utf8');let data,body;
  try{({data,body}=parseFrontmatter(text));}catch(e){add('error','FRONTMATTER',file,e.message);continue;}
  if(typeof data.description!=='string'||!data.description.trim())add('error','DESCRIPTION',file,'Pack requires a non-empty description');
  if(typeof data.globs!=='string'||!data.globs.trim())add('error','GLOBS',file,'Pack requires comma-separated globs in one string');
  if(typeof data.alwaysApply!=='boolean')add('error','ALWAYS_APPLY',file,'alwaysApply must be an unquoted boolean');
  if(!body.trim())add('error','EMPTY_RULE',file,'Rule body is empty');
  if(Buffer.byteLength(text)>maxBytes)add('warning','SIZE',file,'Rule exceeds configured byte budget');
  const matches=[];
  if(typeof data.globs==='string'&&data.globs.trim())for(const g of data.globs.split(',').map(x=>x.trim())){
   try{const rx=globRegex(g),hits=files.filter(f=>!f.startsWith('.cursor/')&&rx.test(f));matches.push(...hits);if(!hits.length)add(strictGlobs?'error':'warning','UNMATCHED_GLOB',file,'No project file matches '+g);}catch(e){add('error','GLOB_SYNTAX',file,e.message);}
  }
  const ruleIds=[...body.matchAll(/^## ((?:LAR|NXT)-[a-z0-9-]+)\s*$/gm)].map(m=>m[1]);
  if(!ruleIds.length)add('error','NO_IDS',file,'Expected at least one ## LAR-id or ## NXT-id heading');
  for(const id of ruleIds){if(ids.has(id))add('error','DUPLICATE_ID',file,`Rule ${id} also appears in ${ids.get(id)}`);else ids.set(id,file);}
  const intended=stack|| (detected.length===1?detected[0]:null);
  for(const id of ruleIds)if(intended&&((id.startsWith('LAR-')&&intended!=='laravel')||(id.startsWith('NXT-')&&intended!=='nextjs-ts')))add('error','WRONG_RULE_STACK',file,'Rule '+id+' does not fit '+intended);
  // Optional machine-readable assertions. This does not infer contradictions in prose.
  const assertions=[...body.matchAll(/^<!-- rulecheck: ([a-z0-9_.-]+)=(allow|deny) -->\s*$/gm)].map(m=>({key:m[1],value:m[2]}));
  rules.push({file,ids:ruleIds,matches:[...new Set(matches)],assertions});
  // Explicit local references only: Markdown links and @file markers. Glob guidance is not a file reference.
  const refs=[...body.matchAll(/\]\(([^)\s]+)\)/g)].map(m=>m[1]);
  refs.push(...[...body.matchAll(/(?:^|\s)@([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/g)].map(m=>m[1]));
  for(const ref of refs){if(/^(?:https?:|mailto:|#)/.test(ref))continue;const clean=ref.split('#')[0];let candidate=path.resolve(root,clean);if(!candidate.startsWith(root+path.sep)){add('error','UNSAFE_REFERENCE',file,ref);continue;}
   if(!fs.existsSync(candidate)){candidate=path.resolve(root,path.dirname(file),clean);if(!candidate.startsWith(root+path.sep)||!fs.existsSync(candidate))add('error','DEAD_REFERENCE',file,'Missing local file '+ref);}
  }
 }
 const assertions=new Map();for(const r of rules)for(const a of r.assertions){if(assertions.has(a.key)&&assertions.get(a.key)!==a.value)add('error','CONTRADICTION',r.file,'Conflicting explicit rulecheck assertion: '+a.key);assertions.set(a.key,a.value);}
 const registry=path.join(root,'rule-ids.json');if(fs.existsSync(registry))try{
  const entries=readJson(registry);if(!Array.isArray(entries))throw new Error('Expected an array');const seen=new Set();
  for(const e of entries){if(!e||typeof e.id!=='string'||!Array.isArray(e.conflicts)||typeof e.file!=='string')throw new Error('Malformed registry entry');if(seen.has(e.id))add('error','REGISTRY_DUPLICATE','rule-ids.json',e.id);seen.add(e.id);
   if(!ids.has(e.id))add('error','REGISTRY_MISSING','rule-ids.json',e.id);else if(ids.get(e.id)!==e.file)add('error','REGISTRY_FILE','rule-ids.json',e.id);
   for(const conflict of e.conflicts)if(ids.has(conflict))add('error','CONTRADICTION','rule-ids.json',`${e.id} conflicts with ${conflict}`);
  }
  for(const id of ids.keys())if(!seen.has(id))add('error','UNREGISTERED','rule-ids.json',id);
 }catch(e){add('error','REGISTRY','rule-ids.json',e.message);}
 const errors=issues.filter(i=>i.level==='error').length,warnings=issues.length-errors;
 return {root,detectedStacks:detected,applicableRuleSets:stack?[stack]:detected,rules:rules.map(({assertions,...r})=>r),errors,warnings,issues,ok:errors===0};
}
export function initProject(root,{stack,write=false,tool='all',sourceRoot=packRoot}={}) {
 root=path.resolve(root);if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw new Error('Project path must be an existing directory');
 const detected=detectStack(root);if(!stack){if(detected.length!==1)throw new Error('Choose --stack laravel or --stack nextjs-ts; stack is ambiguous or unknown');stack=detected[0];}
 if(!['laravel','nextjs-ts'].includes(stack))throw new Error('Unknown stack');if(detected.length&&!detected.includes(stack))throw new Error('Requested stack conflicts with project dependencies');
 if(!['all','claude','cursor','codex'].includes(tool))throw new Error('Unknown tool');
 const src=path.join(sourceRoot,stack),candidates=walk(src).filter(f=>tool==='all'||(tool==='claude'&&f==='CLAUDE.md')||(tool==='codex'&&f==='AGENTS.md')||(tool==='cursor'&&(f.startsWith('.cursor/')||f==='rule-ids.json')));
 const actions=[];for(const rel of candidates){const dest=path.join(root,rel);let current=root,unsafe=false;
  for(const part of rel.split('/').slice(0,-1)){current=path.join(current,part);if(fs.existsSync(current)){const st=fs.lstatSync(current);if(st.isSymbolicLink()||!st.isDirectory()){unsafe=true;break;}}}
  if(unsafe){actions.push({file:rel,status:'blocked-unsafe-parent'});continue;}
  if(fs.existsSync(dest)||(()=>{try{fs.lstatSync(dest);return true;}catch{return false;}})()){actions.push({file:rel,status:'skipped-existing'});continue;}
  if(write){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(src,rel),dest,fs.constants.COPYFILE_EXCL);}
  actions.push({file:rel,status:write?'copied':'would-copy'});
 }
 return {root,stack,tool,dryRun:!write,actions};
}
export function main(argv=process.argv.slice(2)) {
 let target='.',stack,fix=false,write=false,json=false,strict=false,tool='all',maxBytes=16000;
 for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--help'){console.log('node rulecheck.mjs [path] [--stack laravel|nextjs-ts] [--json] [--strict-globs] [--max-bytes N]\nnode rulecheck.mjs [path] --fix-init [--write] [--tool all|claude|cursor|codex]\nInit is dry-run unless --write. Never overwrites existing files. Exit: 0 clean/warnings, 1 validation errors, 2 usage/IO.\nValidation expects both wrappers and Cursor rules; single-tool installs can be valid for the tool but fail full-pack checks.');return 0;}
  if(['--stack','--tool','--max-bytes'].includes(a)&&(!argv[i+1]||argv[i+1].startsWith('--')))throw new Error('Missing value for '+a);
  if(a==='--stack')stack=argv[++i];else if(a==='--tool')tool=argv[++i];else if(a==='--max-bytes')maxBytes=Number(argv[++i]);else if(a==='--fix-init')fix=true;else if(a==='--write')write=true;else if(a==='--json')json=true;else if(a==='--strict-globs')strict=true;else if(a.startsWith('-'))throw new Error('Unknown option '+a);else target=a;
 }
 if(write&&!fix)throw new Error('--write requires --fix-init');if(!Number.isInteger(maxBytes)||maxBytes<1)throw new Error('--max-bytes must be a positive integer');
 if(!fs.existsSync(target)||!fs.statSync(target).isDirectory())throw new Error('Path must be an existing directory');
 const result=fix?initProject(target,{stack,write,tool}):validate(target,{stack,strictGlobs:strict,maxBytes});
 if(json)console.log(JSON.stringify(result,null,2));else if(fix){console.log(`${result.dryRun?'DRY RUN':'INIT'} ${result.stack} (${result.tool})`);for(const a of result.actions)console.log(`${a.status}: ${a.file}`);}else{console.log(`rulecheck: ${result.errors} errors, ${result.warnings} warnings`);console.log('Applicable: '+(result.applicableRuleSets.join(', ')||'unknown'));for(const i of result.issues)console.log(`${i.level.toUpperCase()} ${i.code} ${i.file}: ${i.message}`);console.log('Checks: flat frontmatter, file globs, IDs, explicit conflicts, references and size. No semantic/security certification.');}
 return fix?(result.actions.some(a=>a.status==='blocked-unsafe-parent')?1:0):(result.ok?0:1);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{process.exitCode=main();}catch(e){console.error('rulecheck: '+e.message);process.exitCode=2;}
