import type { ProviderProfile } from '../../lib/openai/provider-profile';

interface CompatibilityHelpProps {
  profile: ProviderProfile;
  onApplyProfileDefaults: () => void;
}

export function CompatibilityHelp({
  profile,
  onApplyProfileDefaults,
}: CompatibilityHelpProps) {
  const isRecognizedProfile = profile.id !== 'default';

  return (
    <div className={`compatibility-help${isRecognizedProfile ? ' compatibility-help--recognized' : ''}`}>
      <div className="compatibility-help__header">
        <div>
          <p className="compatibility-help__eyebrow">{isRecognizedProfile ? '已识别 provider 特征' : '本地使用说明'}</p>
          <h3>{isRecognizedProfile ? profile.label : '先走标准兼容，失败再回退'}</h3>
          <p className="compatibility-help__body">{profile.description}</p>
        </div>
        {isRecognizedProfile ? (
          <button className="button button--ghost" type="button" onClick={onApplyProfileDefaults}>
            应用推荐参数
          </button>
        ) : null}
      </div>
      <ul>
        {profile.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        {!isRecognizedProfile ? <li>凭证只保存在当前浏览器本地，适合个人设备，不适合共享机器。</li> : null}
      </ul>
    </div>
  );
}
