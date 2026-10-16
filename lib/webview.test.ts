import { jsonPourScript } from './webview';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe('jsonPourScript', () => {
  it('neutralise </script> et garde la valeur d origine', () => {
    const v = [{ nom: '</script><script>alert(1)</script>', adresse: '<!-- x' }];
    const s = jsonPourScript(v);
    expect(s.toLowerCase()).not.toContain('</script');
    expect(s).not.toContain('<');
    expect(JSON.parse(s)).toEqual(v);
  });

  it('échappe U+2028 et U+2029', () => {
    const v = { nom: `a${LS}b${PS}c` };
    const s = jsonPourScript(v);
    expect(s).not.toContain(LS);
    expect(s).not.toContain(PS);
    expect(JSON.parse(s)).toEqual(v);
  });
});
