import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import L from 'leaflet'

const BASE_URL = import.meta.env.BASE_URL

const YEARS = [2022, 2023, 2024, 2025, 2026]

const gradeMeta = {
  1: { label: '매우 높음', color: '#08519c' },
  2: { label: '높음', color: '#3182bd' },
  3: { label: '다소 높음', color: '#6baed6' },
  4: { label: '보통', color: '#bdd7e7' },
  5: { label: '다소 낮음', color: '#fdd0a2' },
  6: { label: '낮음', color: '#f16913' },
  7: { label: '매우 낮음', color: '#a63603' },
}

const domainColorConfig = {
  duvi_score: {
    name: '종합 DUVI',
    dark: '#08519c',
    steps: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#2563eb', '#08519c'],
  },
  'domain_score__상권': {
    name: '상권',
    dark: '#7c3aed',
    steps: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#6d28d9'],
  },
  'domain_score__인구': {
    name: '인구',
    dark: '#dc2626',
    steps: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#b91c1c'],
  },
  'domain_score__주택시장_주거위험': {
    name: '주택위험',
    dark: '#be123c',
    steps: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#e11d48', '#9f1239'],
  },
  'domain_score__생활시설': {
    name: '생활시설',
    dark: '#059669',
    steps: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#047857'],
  },
  'domain_score__버스교통': {
    name: '버스',
    dark: '#16a34a',
    steps: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#15803d'],
  },
  'domain_score__지하철교통': {
    name: '지하철',
    dark: '#2563eb',
    steps: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'],
  },
  'domain_score__SDOT유동': {
    name: 'SDOT',
    dark: '#0891b2',
    steps: ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0e7490'],
  },
  'domain_score__에너지': {
    name: '에너지',
    dark: '#ca8a04',
    steps: ['#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#a16207'],
  },
  'domain_score__생활인구': {
    name: '생활인구',
    dark: '#ea580c',
    steps: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#c2410c'],
  },
  safety_score: {
    name: '안전',
    dark: '#0f766e',
    steps: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0f766e'],
  },
}

function getDomainColor(domainKey, value) {
  const config = domainColorConfig[domainKey] ?? domainColorConfig.duvi_score
  const steps = config.steps

  if (value === null || value === undefined || Number.isNaN(value)) return '#d9d9d9'
  if (value >= 85) return steps[6]
  if (value >= 70) return steps[5]
  if (value >= 55) return steps[4]
  if (value >= 40) return steps[3]
  if (value >= 25) return steps[2]
  if (value >= 10) return steps[1]
  return steps[0]
}

function makeDomainLegend(domainKey) {
  if (domainKey === 'duvi_score') {
    return [
      { label: '1등급', desc: '매우 높음', color: gradeMeta[1].color },
      { label: '2등급', desc: '높음', color: gradeMeta[2].color },
      { label: '3등급', desc: '다소 높음', color: gradeMeta[3].color },
      { label: '4등급', desc: '보통', color: gradeMeta[4].color },
      { label: '5등급', desc: '다소 낮음', color: gradeMeta[5].color },
      { label: '6등급', desc: '낮음', color: gradeMeta[6].color },
      { label: '7등급', desc: '매우 낮음', color: gradeMeta[7].color },
      { label: '자료 없음', desc: '미산정/결측', color: '#d9d9d9' },
    ]
  }

  const config = domainColorConfig[domainKey] ?? domainColorConfig.duvi_score
  const steps = config.steps

  return [
    { label: '85점 이상', desc: '매우 높음', color: steps[6] },
    { label: '70~85점', desc: '높음', color: steps[5] },
    { label: '55~70점', desc: '다소 높음', color: steps[4] },
    { label: '40~55점', desc: '보통', color: steps[3] },
    { label: '25~40점', desc: '다소 낮음', color: steps[2] },
    { label: '10~25점', desc: '낮음', color: steps[1] },
    { label: '10점 미만', desc: '매우 낮음', color: steps[0] },
    { label: '자료 없음', desc: '미산정/결측', color: '#d9d9d9' },
  ]
}


function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatScore(value) {
  const n = toNumber(value)
  return n === null ? '-' : n.toFixed(2)
}

export default function App() {
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const geoLayerRef = useRef(null)
  const selectedLayerRef = useRef(null)

  const [page, setPage] = useState('home')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [duviRows, setDuviRows] = useState([])
  const [detailRows, setDetailRows] = useState([])
  const [geoData, setGeoData] = useState(null)
  const [sggGeoData, setSggGeoData] = useState(null)
  const [safetyRows, setSafetyRows] = useState([])
  const [selectedDong, setSelectedDong] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [csvText, detailCsvText, geoJson, sggGeoJson, safetyCsvText] = await Promise.all([
          fetch(`${BASE_URL}data/duvi_result_only_panel_2022_2026.csv`).then((res) => res.text()),
          fetch(`${BASE_URL}data/duvi_score_panel_2022_2026.csv`).then((res) => res.text()),
          fetch(`${BASE_URL}data/seoul_admin_dong.geojson`).then((res) => res.json()),
          fetch(`${BASE_URL}data/seoul_sgg.geojson`).then((res) => res.json()),
          fetch(`${BASE_URL}data/safety_gu_summary_2023_2024_web.csv`).then((res) => res.text()),
        ])

        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        })

        const detailParsed = Papa.parse(detailCsvText, {
          header: true,
          skipEmptyLines: true,
        })

        const safetyParsed = Papa.parse(safetyCsvText, {
          header: true,
          skipEmptyLines: true,
        })

        setDuviRows(parsed.data)
        setDetailRows(detailParsed.data)
        setGeoData(geoJson)
        setSggGeoData(sggGeoJson)
        setSafetyRows(safetyParsed.data)

      } catch (error) {
        console.error('데이터 로딩 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const yearRows = useMemo(() => {
    return duviRows
      .filter((row) => Number(row.duvi_year) === selectedYear)
      .map((row) => ({
        ...row,
        duvi_score_num: toNumber(row.duvi_score),
        duvi_grade_num: toNumber(row.duvi_grade),
      }))
  }, [duviRows, selectedYear])

  const rowByCode = useMemo(() => {
    const map = new Map()
    yearRows.forEach((row) => {
      map.set(String(row.admin_dong_code).trim(), row)
    })
    return map
  }, [yearRows])

  const detailByKey = useMemo(() => {
    const map = new Map()

    detailRows.forEach((row) => {
      const key = `${row.duvi_year}_${String(row.admin_dong_code).trim()}`
      map.set(key, row)
    })

    return map
  }, [detailRows])

  const selectedDetail = useMemo(() => {
    if (!selectedDong) return null

    const key = `${selectedDong.duvi_year}_${String(selectedDong.admin_dong_code).trim()}`
    return detailByKey.get(key) ?? null
  }, [selectedDong, detailByKey])

  const selectedDomainScores = useMemo(() => {
    if (!selectedDetail) return []

    const domains = [
      { key: 'domain_score__상권', label: '상권' },
      { key: 'domain_score__인구', label: '인구' },
      { key: 'domain_score__주택시장_주거위험', label: '주택·주거위험' },
      { key: 'domain_score__생활시설', label: '생활시설' },
      { key: 'domain_score__버스교통', label: '버스교통' },
      { key: 'domain_score__지하철교통', label: '지하철교통' },
      { key: 'domain_score__SDOT유동', label: 'SDOT 유동' },
      { key: 'domain_score__에너지', label: '에너지' },
      { key: 'domain_score__생활인구', label: '생활인구' },
    ]

    return domains.map((domain) => {
      const value = toNumber(selectedDetail[domain.key])
      return {
        ...domain,
        value,
      }
    })
  }, [selectedDetail])

  const topRows = useMemo(() => {
    return [...yearRows]
      .filter((row) => row.duvi_score_num !== null)
      .sort((a, b) => b.duvi_score_num - a.duvi_score_num)
      .slice(0, 10)
  }, [yearRows])

  const summary = useMemo(() => {
    const valid = yearRows.filter((row) => row.duvi_score_num !== null)

    if (valid.length === 0) {
      return { avg: 0, max: 0, min: 0 }
    }

    const scores = valid.map((row) => row.duvi_score_num)

    return {
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
      min: Math.min(...scores),
    }
  }, [yearRows])

  useEffect(() => {
    if (!geoData || !mapElementRef.current) return

    if (!mapRef.current) {
      mapRef.current = L.map(mapElementRef.current, {
        center: [37.5665, 126.9780],
        zoom: 11,
        minZoom: 10,
        maxZoom: 14,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current)
    }

    if (geoLayerRef.current) {
      geoLayerRef.current.remove()
    }

    function getFeatureStyle(feature) {
      const code = String(feature.properties.admin_dong_code ?? feature.properties.ADM_CD ?? '').trim()
      const row = rowByCode.get(code)
      const grade = row?.duvi_grade_num
      const meta = gradeMeta[grade]

      return {
        fillColor: meta?.color ?? '#d9d9d9',
        weight: 0.6,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: row ? 0.82 : 0.25,
      }
    }

    geoLayerRef.current = L.geoJSON(geoData, {
      style: getFeatureStyle,
      onEachFeature: (feature, layer) => {
        const code = String(feature.properties.admin_dong_code ?? feature.properties.ADM_CD ?? '').trim()
        const row = rowByCode.get(code)

        const name = row?.admin_dong_name ?? feature.properties.admin_dong_name ?? feature.properties.ADM_NM
        const score = row ? formatScore(row.duvi_score) : '-'
        const grade = row ? `${row.duvi_grade}등급 ${row.duvi_grade_label}` : '자료 없음'

        layer.bindTooltip(`${name}<br/>DUVI ${score}<br/>${grade}`, {
          sticky: true,
          direction: 'top',
        })

        layer.on({
          click: () => {
            if (row) {
              // 이전 선택 행정동 스타일 원복
              if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
                selectedLayerRef.current.setStyle(getFeatureStyle(selectedLayerRef.current.feature))
              }

              selectedLayerRef.current = layer
              setSelectedDong(row)

              // 클릭한 행정동을 항상 맨 위로 올림
              layer.bringToFront()
              layer.setStyle({
                weight: 4,
                color: '#00e0ff',
                fillOpacity: 0.95,
              })
            }
          },
          mouseover: () => {
            layer.bringToFront()
            layer.setStyle({
              weight: 2.5,
              color: '#111827',
              fillOpacity: 0.95,
            })
          },
          mouseout: () => {
            // 선택된 행정동이면 선택 스타일 유지
            if (selectedLayerRef.current === layer) {
              layer.bringToFront()
              layer.setStyle({
                weight: 4,
                color: '#00e0ff',
                fillOpacity: 0.95,
              })
            } else {
              layer.setStyle(getFeatureStyle(feature))
            }
          },
        })
      },
    }).addTo(mapRef.current)

    try {
      const bounds = geoLayerRef.current.getBounds()
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] })
      }
    } catch (error) {
      console.warn('지도 bounds 조정 실패:', error)
    }
  }, [geoData, rowByCode, selectedYear])

  if (loading) {
    return (
      <div className="loading-screen">
        <img src={`${BASE_URL}logo_icon.png`} alt="DUVI logo" />
        <p>DUVI 데이터를 불러오는 중입니다...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="site-header">
        <div
          className="brand"
          role="button"
          tabIndex={0}
          onClick={() => setPage('home')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              setPage('home')
            }
          }}
        >
          <img src={`${BASE_URL}logo_icon.png`} alt="DUVI logo" />
          <div>
            <strong>DUVI</strong>
            <span>서울 행정동 도시활력지표</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={page === 'home' ? 'active' : ''}
            onClick={() => setPage('home')}
          >
            종합지도
          </button>
          <button
            className={page === 'explore' ? 'active' : ''}
            onClick={() => setPage('explore')}
          >
            세부탐색
          </button>
        </div>
      </header>

      {page === 'home' && <SideStepper />}

      <main>
        {page === 'home' ? (
          <>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Data-driven Urban Vitality Index</p>
            <h1>서울 426개 행정동의 도시활력을<br />연도별로 비교합니다.</h1>
            <p>
              상권, 인구, 주택위험, 생활시설, 교통, SDOT 유동인구, 에너지, 생활인구를 결합해
              2022년부터 2026년까지의 DUVI 점수와 7등급을 산정했습니다.
            </p>
          </div>

          <div className="hero-cards">
            <InfoCard icon="🗺️" label="공간 단위" value="426개 행정동" />
            <InfoCard icon="📊" label="분석 기간" value="2022~2026" />
            <InfoCard icon="🧭" label="최종 등급" value="7등급 체계" />
          </div>
        </section>

        <section id="map" className="dashboard">
          <aside className="control-panel">
            <div className="panel-block">
              <h2>DUVI 지도</h2>
              <p>연도를 선택하면 해당 연도 행정동별 DUVI 등급이 지도에 표시됩니다.</p>
            </div>
            <button
              className="primary-link-button"
              onClick={() => setPage('explore')}
            >
              분야별 상세 살펴보기 →
            </button>

            <div className="year-buttons">
              {YEARS.map((year) => (
                <button
                  key={year}
                  className={selectedYear === year ? 'active' : ''}
                  onClick={() => {
                    setSelectedYear(year)
                    setSelectedDong(null)
                    selectedLayerRef.current = null
                  }}
                >
                  {year}
                </button>
              ))}
            </div>

            <div className="summary-grid">
              <div>
                <span>평균 점수</span>
                <strong>{summary.avg.toFixed(2)}</strong>
              </div>
              <div>
                <span>최고 점수</span>
                <strong>{summary.max.toFixed(2)}</strong>
              </div>
              <div>
                <span>최저 점수</span>
                <strong>{summary.min.toFixed(2)}</strong>
              </div>
            </div>

            <div className="legend">
              <h3>DUVI 7등급</h3>
              {Object.entries(gradeMeta).map(([grade, meta]) => (
                <div key={grade} className="legend-row">
                  <span style={{ backgroundColor: meta.color }} />
                  <p>{grade}등급 · {meta.label}</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="map-card">
            <div ref={mapElementRef} className="map" />
          </section>

          <aside className="detail-panel">
            {selectedDong ? (
              <>
                <p className="eyebrow">선택 행정동</p>
                <h2>{selectedDong.sgg_nm} {selectedDong.admin_dong_name}</h2>
                <div className="score-box">
                  <span>DUVI Score</span>
                  <strong>{formatScore(selectedDong.duvi_score)}</strong>
                </div>
                <div className="grade-box">
                  <span>{selectedDong.duvi_grade}등급</span>
                  <strong>{selectedDong.duvi_grade_label}</strong>
                </div>
                <div className="domain-score-panel">
                  <div className="panel-subtitle">
                    <strong>영역별 점수</strong>
                    <span>0~100점 기준</span>
                  </div>

                  {selectedDomainScores.map((item) => (
                    <div className="domain-score-row" key={item.key}>
                      <div className="domain-score-head">
                        <span>{item.label}</span>
                        <strong>{item.value === null ? '-' : item.value.toFixed(1)}</strong>
                      </div>
                      <div className="domain-score-track">
                        <div
                          className="domain-score-fill"
                          style={{ width: `${item.value === null ? 0 : Math.max(0, Math.min(100, item.value))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>사용 영역 수</dt>
                    <dd>{selectedDong.duvi_domain_count_used}</dd>
                  </div>
                  <div>
                    <dt>사용 변수 수</dt>
                    <dd>{selectedDong.duvi_variable_count_used}</dd>
                  </div>
                  <div>
                    <dt>행정동 코드</dt>
                    <dd>{selectedDong.admin_dong_code}</dd>
                  </div>
                </dl>
                <div className="notice-box">
                  <strong>왜 사용 변수 수가 다를까요?</strong>
                  <p>
                    DUVI는 역, 센서, 공동주택 단지 등 서로 다른 단위의 원자료를 행정동 단위로 재집계합니다.
                    지하철역이 없는 행정동은 지하철 승하차 총량이 0으로 집계되며, SDOT 센서나 공동주택
                    에너지 자료가 없는 행정동은 일부 평균 지표가 결측으로 유지됩니다. 따라서 행정동별로
                    실제 산정에 반영된 변수 수가 달라질 수 있습니다.
                  </p>
                </div>
              </>
            ) : (
              <div className="empty-detail">
                <div className="empty-icon">📍</div>
                <h2>행정동을 선택하세요</h2>
                <p>지도에서 행정동을 클릭하면 DUVI 점수와 등급이 표시됩니다.</p>
              </div>
            )}
          </aside>
        </section>

        <section id="ranking" className="ranking-section">
          <div className="section-title">
            <p className="eyebrow">{selectedYear} Ranking</p>
            <h2>{selectedYear}년 DUVI 상위 10개 행정동</h2>
          </div>

          <div className="ranking-table">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>자치구</th>
                  <th>행정동</th>
                  <th>점수</th>
                  <th>등급</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((row, index) => (
                  <tr key={`${row.duvi_year}-${row.admin_dong_code}`}>
                    <td>{index + 1}</td>
                    <td>{row.sgg_nm}</td>
                    <td>{row.admin_dong_name}</td>
                    <td>{formatScore(row.duvi_score)}</td>
                    <td>{row.duvi_grade}등급 · {row.duvi_grade_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="method" className="method-section">
          <div className="section-title">
            <p className="eyebrow">Methodology</p>
            <h2>DUVI 산정 방식</h2>
          </div>

          <div className="method-grid">
            <MethodCard title="1. 데이터 결합" text="행정동코드를 기준으로 상권, 인구, 주택위험, 생활시설, 교통, 에너지, 생활인구 데이터를 결합했습니다." />
            <MethodCard title="2. 0~100점화" text="단위가 다른 지표를 비교하기 위해 연도별 최소-최대 정규화를 적용했습니다." />
            <MethodCard title="3. 역방향 처리" text="전세가율, 건축물 연식, 에너지 비용처럼 높을수록 부담이 큰 변수는 역방향으로 점수화했습니다." />
            <MethodCard title="4. 7등급화" text="최종 DUVI 점수를 연도별 7분위로 분류해 지도화와 해석이 가능하도록 했습니다." />
          </div>
        </section>
      </>
      ) : (
    <ExplorePage
      selectedYear={selectedYear}
      setSelectedYear={setSelectedYear}
      detailRows={detailRows}
      geoData={geoData}
      sggGeoData={sggGeoData}
      safetyRows={safetyRows}
    />
  )}
      </main>
    </div>
  )
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="info-card">
      <div className="info-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MethodCard({ title, text }) {
  return (
    <article className="method-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function SideStepper() {
  const sections = [
    { id: 'map', label: '지도' },
    { id: 'ranking', label: '랭킹' },
    { id: 'method', label: '방법론' },
  ]

  return (
    <nav className="side-stepper" aria-label="페이지 섹션 이동">
      {sections.map((section, index) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="step-item"
          aria-label={`${section.label} 섹션으로 이동`}
        >
          <span className="step-dot">{index + 1}</span>
          <span className="step-label">{section.label}</span>
        </a>
      ))}
    </nav>
  )
}

function DomainRanking({ title, rows, isSafetyDomain = false }) {
  return (
    <article className="domain-ranking-card">
      <h3>{title}</h3>
      <div className="mini-ranking-list">
        {rows.map((row, index) => {
          const placeName = isSafetyDomain
            ? row.sgg_nm
            : `${row.sgg_nm} ${row.admin_dong_name}`

          const keyValue = isSafetyDomain
            ? row.sgg_nm
            : row.admin_dong_code

          return (
            <div
              className="mini-ranking-row"
              key={`${title}-${row.duvi_year ?? row.safety_year}-${keyValue}`}
            >
              <span>{index + 1}</span>
              <p>{placeName}</p>
              <strong>{row.selected_score.toFixed(1)}</strong>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function ExplorePage({ selectedYear, setSelectedYear, detailRows, geoData, sggGeoData, safetyRows }) {
  const exploreMapRef = useRef(null)
  const exploreMapInstanceRef = useRef(null)
  const exploreGeoLayerRef = useRef(null)
  const exploreSelectedLayerRef = useRef(null)

  const [selectedDomain, setSelectedDomain] = useState('duvi_score')
  const [selectedDong, setSelectedDong] = useState(null)

const domains = [
  {
    key: 'duvi_score',
    label: '종합 DUVI',
    desc: '모든 영역 점수를 종합한 최종 도시활력지표입니다.',
    period: '2022~2026',
    selectableYears: [2022, 2023, 2024, 2025, 2026],
    yearNote: '연도별 DUVI 산정 결과',
  },
  {
    key: 'domain_score__상권',
    label: '상권',
    desc: '업소 수와 주요 소비·방문 업종을 기반으로 한 상권 활력 지표입니다.',
    period: '2022~2025',
    selectableYears: [2022, 2023, 2024, 2025, 2026],
    substituteMap: { 2026: 2025 },
    yearNote: '2026년은 2025년 상권 최신값을 대체 사용',
  },
  {
    key: 'domain_score__인구',
    label: '인구',
    desc: '정주 인구 규모와 인구 변화 흐름을 반영한 지표입니다.',
    period: '2022~2024',
    selectableYears: [2022, 2023, 2024, 2025, 2026],
    substituteMap: { 2025: 2024, 2026: 2024 },
    yearNote: '2025~2026년은 2024년 인구 최신값을 대체 사용',
  },
  {
    key: 'domain_score__주택시장_주거위험',
    label: '주택위험',
    desc: '주택 거래 활력과 전세가율, 건축물 연식 등 주거위험을 함께 반영한 지표입니다.',
    period: '2022~2026',
    selectableYears: [2022, 2023, 2024, 2025, 2026],
    yearNote: '연도별 주택위험 산정 결과',
  },
  {
    key: 'domain_score__생활시설',
    label: '생활시설',
    desc: '교육·의료·문화·복지시설 등 생활 인프라 수준을 나타내는 최신 단면 지표입니다.',
    period: '최신 단면',
    selectableYears: ['latest'],
    fixedYear: 2026,
    yearNote: '연도별 변화가 아닌 최신 생활 인프라 수준',
  },
  {
    key: 'domain_score__버스교통',
    label: '버스',
    desc: '버스 승하차 총량을 기반으로 한 이동 활력 지표입니다.',
    period: '2026.03.01~2026.04.30',
    selectableYears: ['2026.03~04'],
    fixedYear: 2026,
    yearNote: '2026년 3~4월 교통카드 집계자료',
  },
  {
    key: 'domain_score__지하철교통',
    label: '지하철',
    desc: '지하철 승하차 총량을 기반으로 한 광역 이동 활력 지표입니다.',
    period: '2026.03.01~2026.04.30',
    selectableYears: ['2026.03~04'],
    fixedYear: 2026,
    yearNote: '2026년 3~4월 지하철 승하차 자료',
  },
  {
    key: 'domain_score__SDOT유동',
    label: 'SDOT',
    desc: '서울시 도시데이터 센서 기반 유동인구 지표입니다.',
    period: '2026.04.11~2026.05.17',
    selectableYears: ['2026.04~05'],
    fixedYear: 2026,
    yearNote: '2026년 4~5월 SDOT 방문자 센서 자료',
  },
  {
    key: 'domain_score__에너지',
    label: '에너지',
    desc: '공동주택 전기 사용량과 에너지 비용 부담을 함께 반영한 보조 지표입니다.',
    period: '2024.01~2026.05',
    selectableYears: ['2024.01~2026.05'],
    fixedYear: 2026,
    yearNote: '2024년 1월~2026년 5월 기간 평균 자료',
  },
  {
    key: 'domain_score__생활인구',
    label: '생활인구',
    desc: '생활이동 자료 기반 유입 및 순유입 흐름을 반영한 지표입니다.',
    period: '2026.01~2026.04',
    selectableYears: ['2026.01~04'],
    fixedYear: 2026,
    yearNote: '2026년 1~4월 생활이동 인구 자료',
  },
  {
    key: 'safety_score',
    label: '안전',
    desc: '자치구 단위 안전지표를 기반으로 한 보조 안전 수준 지표입니다. 원자료가 구 단위이므로 자치구 경계 기준으로 시각화합니다.',
    period: '2023~2024',
    selectableYears: [2023, 2024],
    unit: 'sgg',
    yearNote: '안전지표는 자치구 단위 자료로, 행정동 DUVI와 별도 보조지표로 해석합니다.',
  },
]

  const selectedMeta = domains.find((item) => item.key === selectedDomain)
  const isSafetyDomain = selectedMeta?.unit === 'sgg'

  const activeLegend = useMemo(() => {
    return makeDomainLegend(selectedDomain)
  }, [selectedDomain])
  const effectiveYear = useMemo(() => {
  if (!selectedMeta) return selectedYear

  if (selectedMeta.fixedYear) {
    return selectedMeta.fixedYear
  }

  if (selectedMeta.substituteMap && selectedMeta.substituteMap[selectedYear]) {
    return selectedMeta.substituteMap[selectedYear]
  }

  return selectedYear
}, [selectedMeta, selectedYear])

  const yearDetailRows = useMemo(() => {
    if (isSafetyDomain) {
      return safetyRows
        .filter((row) => Number(row.safety_year) === Number(selectedYear))
        .map((row) => ({
          ...row,
          admin_dong_code: row.sgg_nm,
          admin_dong_name: row.sgg_nm,
          selected_score: toNumber(row.safety_score),
          selected_label: row.safety_value_label,
        }))
        .filter((row) => row.selected_score !== null)
    }

    return detailRows
      .filter((row) => Number(row.duvi_year) === effectiveYear)
      .map((row) => ({
        ...row,
        selected_score: toNumber(row[selectedDomain]),
      }))
      .filter((row) => row.selected_score !== null)
  }, [detailRows, safetyRows, effectiveYear, selectedYear, selectedDomain, isSafetyDomain])

  const detailByCode = useMemo(() => {
    const map = new Map()

    yearDetailRows.forEach((row) => {
      if (isSafetyDomain) {
        map.set(String(row.sgg_nm).trim(), row)
      } else {
        map.set(String(row.admin_dong_code).trim(), row)
      }
    })

    return map
  }, [yearDetailRows, isSafetyDomain])

  const topRows = useMemo(() => {
    return [...yearDetailRows]
      .sort((a, b) => b.selected_score - a.selected_score)
      .slice(0, 10)
  }, [yearDetailRows])

  const bottomRows = useMemo(() => {
    return [...yearDetailRows]
      .sort((a, b) => a.selected_score - b.selected_score)
      .slice(0, 10)
  }, [yearDetailRows])

  const summary = useMemo(() => {
    if (yearDetailRows.length === 0) return { avg: 0, max: 0, min: 0 }

    const scores = yearDetailRows.map((row) => row.selected_score)
    return {
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
      min: Math.min(...scores),
    }
  }, [yearDetailRows])

  useEffect(() => {
    const activeGeoData = isSafetyDomain ? sggGeoData : geoData

    if (!activeGeoData || !exploreMapRef.current) return

    if (!exploreMapInstanceRef.current) {
      exploreMapInstanceRef.current = L.map(exploreMapRef.current, {
        center: [37.5665, 126.9780],
        zoom: 11,
        minZoom: 10,
        maxZoom: 14,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(exploreMapInstanceRef.current)
    }

    if (exploreGeoLayerRef.current) {
      exploreGeoLayerRef.current.remove()
    }

    function getScoreColor(value, row) {
      if (selectedDomain === 'duvi_score') {
        const grade = Number(row?.duvi_grade)
        return gradeMeta[grade]?.color ?? '#d9d9d9'
      }

      return getDomainColor(selectedDomain, value)
    }

    function getFeatureStyle(feature) {
      const code = isSafetyDomain
        ? String(feature.properties.sgg_nm ?? '').trim()
        : String(feature.properties.admin_dong_code ?? feature.properties.ADM_CD ?? '').trim()

      const row = detailByCode.get(code)
      const value = row?.selected_score

      return {
        fillColor: getScoreColor(value, row),
        weight: 0.6,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: row ? 0.82 : 0.22,
      }
    }

    exploreGeoLayerRef.current = L.geoJSON(activeGeoData, {
      style: getFeatureStyle,
      onEachFeature: (feature, layer) => {
        const code = isSafetyDomain
          ? String(feature.properties.sgg_nm ?? '').trim()
          : String(feature.properties.admin_dong_code ?? feature.properties.ADM_CD ?? '').trim()

        const row = detailByCode.get(code)

        const name = isSafetyDomain
          ? feature.properties.sgg_nm
          : row?.admin_dong_name ?? feature.properties.admin_dong_name ?? feature.properties.ADM_NM

        const score = row ? row.selected_score.toFixed(2) : '-'
        const gradeText =
          selectedDomain === 'duvi_score' && row
            ? `<br/>${row.duvi_grade}등급 ${row.duvi_grade_label}`
            : ''

        layer.bindTooltip(`${name}<br/>${selectedMeta?.label}: ${score}${gradeText}`, {
          sticky: true,
          direction: 'top',
        })

        layer.on({
          click: () => {
            if (row) {
              if (exploreSelectedLayerRef.current && exploreSelectedLayerRef.current !== layer) {
                exploreSelectedLayerRef.current.setStyle(getFeatureStyle(exploreSelectedLayerRef.current.feature))
              }

              exploreSelectedLayerRef.current = layer
              setSelectedDong(row)

              layer.bringToFront()
              layer.setStyle({
                weight: 4,
                color: '#00e0ff',
                fillOpacity: 0.95,
              })
            }
          },
          mouseover: () => {
            layer.bringToFront()
            layer.setStyle({
              weight: 2.5,
              color: '#111827',
              fillOpacity: 0.95,
            })
          },
          mouseout: () => {
            if (exploreSelectedLayerRef.current === layer) {
              layer.bringToFront()
              layer.setStyle({
                weight: 4,
                color: '#00e0ff',
                fillOpacity: 0.95,
              })
            } else {
              layer.setStyle(getFeatureStyle(feature))
            }
          },
        })
      },
    }).addTo(exploreMapInstanceRef.current)

    try {
      const bounds = exploreGeoLayerRef.current.getBounds()
      if (bounds.isValid()) {
        exploreMapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] })
      }
    } catch (error) {
      console.warn('세부탐색 지도 bounds 조정 실패:', error)
    }

    setTimeout(() => {
      exploreMapInstanceRef.current?.invalidateSize()
    }, 100)
  }, [geoData, sggGeoData, detailByCode, selectedDomain, selectedMeta, isSafetyDomain])

  return (
    <section className="explore-page">
      <div className="explore-hero">
        <p className="eyebrow">Detailed Explorer</p>
        <h1>분야별 도시활력 세부탐색</h1>
        <p>
          종합 DUVI는 모든 영역을 동일 가중 방식으로 결합한 결과입니다. 세부탐색에서는
          사용자의 관심 목적에 따라 상권, 인구, 주택위험, 생활시설, 교통, 에너지, 생활인구
          영역을 따로 선택해 지도와 순위로 확인할 수 있습니다.
        </p>
      </div>

      <div className="explore-controls">
        <div>
          <span>분야 선택</span>
          <div className="domain-tabs compact">
            {domains.map((domain) => (
              <button
                key={domain.key}
                className={selectedDomain === domain.key ? 'active' : ''}
                onClick={() => {
                  setSelectedDomain(domain.key)
                  setSelectedDong(null)
                  exploreSelectedLayerRef.current = null
                }}
              >
                {domain.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span>연도/기간 선택</span>
          <div className="year-buttons compact">
            {selectedMeta?.selectableYears.map((option) => {
              const isFixed = selectedMeta.fixedYear
              const isActive = isFixed ? true : selectedYear === option

              return (
                <button
                  key={option}
                  className={isActive ? 'active' : ''}
                  disabled={isFixed}
                  onClick={() => {
                    if (!isFixed) {
                      setSelectedYear(option)
                    }
                    setSelectedDong(null)
                    exploreSelectedLayerRef.current = null
                  }}
                >
                  {option === 'latest' ? '최신' : option}
                </button>
              )
            })}
          </div>

          <p className="period-note">
            {selectedMeta?.yearNote}
            {effectiveYear !== selectedYear && !selectedMeta?.fixedYear
              ? ` · 실제 적용 연도: ${effectiveYear}년`
              : ''}
          </p>
        </div>
      </div>

      <div className="explore-layout">
        <aside className="explore-info-card">
          <span>
            {selectedMeta?.fixedYear
              ? selectedMeta.period
              : `${selectedYear}년 선택 지표`}
          </span>
          <h2 className="domain-title">
            <span
              className="domain-color-dot"
              style={{ backgroundColor: domainColorConfig[selectedDomain]?.dark }}
            />
            {selectedMeta?.label}
          </h2>
          <p>{selectedMeta?.desc}</p>
          <dl>
            <div>
              <dt>자료 기준</dt>
              <dd>{selectedMeta?.period}</dd>
            </div>
            <div>
              <dt>적용 연도</dt>
              <dd>{effectiveYear}년</dd>
            </div>
            <div>
              <dt>{isSafetyDomain ? '산정 가능 구' : '산정 가능 동'}</dt>
              <dd>{yearDetailRows.length}개</dd>
            </div>
            <div>
              <dt>평균 점수</dt>
              <dd>{summary.avg.toFixed(2)}</dd>
            </div>
            <div>
              <dt>최고 점수</dt>
              <dd>{summary.max.toFixed(2)}</dd>
            </div>
          </dl>

          <div className="explore-legend">
            <h3>지도 색상 기준</h3>
            {activeLegend.map((item) => (
              <div className="explore-legend-row" key={item.label}>
                <span style={{ backgroundColor: item.color }} />
                <p>
                  <strong>{item.desc}</strong>
                  <em>{item.label}</em>
                </p>
              </div>
            ))}
          </div>

          {selectedDong && (
            <div className="selected-domain-box">
              <strong>
                {isSafetyDomain
                  ? selectedDong.sgg_nm
                  : `${selectedDong.sgg_nm} ${selectedDong.admin_dong_name}`}
              </strong>
              <span>{selectedMeta?.label} 점수</span>
              <b>{selectedDong.selected_score.toFixed(2)}</b>
            </div>
          )}
        </aside>

        <section className="explore-map-card">
          <div ref={exploreMapRef} className="explore-map" />
        </section>

        <aside className="explore-ranking-panel">
          <DomainRanking
            title={isSafetyDomain ? "상위 10개 자치구" : "상위 10개 행정동"}
            rows={topRows}
            isSafetyDomain={isSafetyDomain}
          />
          <DomainRanking
            title={isSafetyDomain ? "하위 10개 자치구" : "하위 10개 행정동"}
            rows={bottomRows}
            isSafetyDomain={isSafetyDomain}
          />
        </aside>
      </div>
    </section>
  )
}