import { PEOPLE, type PersonId } from './jobs';
export function Face({ id, size = 44 }: { id: PersonId; size?: number }) {
  const p = PEOPLE[id];
  return (
    <span className={`j-face f-${id}`} style={{ width: size, height: size, fontSize: size, ['--skin' as string]: p.skin, ['--shirt' as string]: p.shirt, ['--hair' as string]: p.hair }} aria-hidden>
      <i className="hair" /><i className="eyes" /><i className="smile" />
    </span>
  );
}
