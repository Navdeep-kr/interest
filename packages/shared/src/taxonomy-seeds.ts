import { InterestTaxonomyNode } from './types';
import { generateDeterministicUnitVector } from './vector-math';

export interface RawTaxonomyCategory {
  slug: string;
  title: string;
  description: string;
  icon: string;
  topics: {
    slug: string;
    title: string;
    description: string;
    niches: {
      slug: string;
      title: string;
      description: string;
    }[];
  }[];
}

/**
 * 3-Level Universal Interest Taxonomy: Category (Level 0) > Topic (Level 1) > Niche (Level 2)
 * Contains 340+ distinct specialized interest nodes across 12 primary domains.
 */
export const COMPREHENSIVE_TAXONOMY: RawTaxonomyCategory[] = [
  // -------------------------------------------------------------------------
  // 1. TECHNOLOGY & COMPUTING
  // -------------------------------------------------------------------------
  {
    slug: 'technology-computing',
    title: 'Technology & Computing',
    description: 'Hardware, software architecture, artificial intelligence, and computing systems.',
    icon: 'hardware-chip-outline',
    topics: [
      {
        slug: 'artificial-intelligence',
        title: 'Artificial Intelligence & ML',
        description: 'Deep learning, neural architectures, and generative systems.',
        niches: [
          { slug: 'prompt-engineering', title: 'Prompt Engineering', description: 'Techniques for in-context reasoning, COT, and LLM steering.' },
          { slug: 'llm-fine-tuning', title: 'LLM Fine-Tuning & LoRA', description: 'Quantization, PEFT, and custom parameter optimization.' },
          { slug: 'diffusion-models', title: 'Diffusion Models & Latent Spaces', description: 'Stable Diffusion, ControlNet, and generative video architectures.' },
          { slug: 'reinforcement-learning', title: 'Reinforcement Learning (RLHF)', description: 'PPO, reward model training, and autonomous agents.' },
          { slug: 'ai-edge-computing', title: 'Edge AI & TinyML', description: 'Running inference on microcontrollers, Coral, and Apple Silicon.' },
          { slug: 'vector-databases', title: 'Vector DBs & Semantic Retrieval', description: 'HNSW indexing, RAG systems, and embedding search.' },
          { slug: 'autonomous-agents', title: 'Autonomous Multi-Agent Systems', description: 'Tool calling, tree-of-thought search, and agentic workflows.' },
        
          { slug: 'ai-interpretability-mechanistic', title: 'Mechanistic Interpretability', description: 'Probing internal attention heads and induction circuits.' },
          { slug: 'neural-rendering-nerf', title: 'Neural Radiance Fields (NeRF)', description: 'Volumetric scene representation and 3D Gaussian splatting.' },
        ],
      },
      {
        slug: 'systems-programming',
        title: 'Systems & Low-Level Programming',
        description: 'Compilers, kernel hacking, and high-performance engineering.',
        niches: [
          { slug: 'rust-systems', title: 'Rust Systems Programming', description: 'Zero-cost abstractions, memory safety, and async runtimes.' },
          { slug: 'os-kernel-dev', title: 'OS & Kernel Development', description: 'Writing operating system kernels, Linux eBPF, and device drivers.' },
          { slug: 'compiler-design', title: 'Compiler & VM Design', description: 'LLVM backends, AST parsers, and JIT compilation.' },
          { slug: 'bare-metal-c', title: 'Bare-Metal C & Firmware', description: 'STM32, ESP32 register programming, and RTOS threads.' },
          { slug: 'high-perf-networking', title: 'High-Performance Networking', description: 'DPDK, io_uring, and zero-copy packet processing.' },
          { slug: 'wasm-runtimes', title: 'WebAssembly & WASI Runtimes', description: 'Bytecode execution, sandboxing, and edge runtimes.' },
        
          { slug: 'simd-gpu-cuda-compute', title: 'SIMD Vectorization & CUDA Kernels', description: 'AVX-512 intrinsics, warp divergence, and GPU compute.' },
          { slug: 'garbage-collection-internals', title: 'Garbage Collection Algorithms', description: 'Generational tracing, semi-space copying, and pause times.' },
        ],
      },
      {
        slug: 'distributed-systems',
        title: 'Distributed Systems & Cloud',
        description: 'Consensus protocols, high-concurrency architectures, and edge computing.',
        niches: [
          { slug: 'raft-consensus', title: 'Raft & Paxos Consensus', description: 'Leader election, distributed state machines, and replication logs.' },
          { slug: 'actor-model-concurrency', title: 'Actor Model & Concurrency', description: 'Erlang/OTP, Akka, and message-passing architectures.' },
          { slug: 'event-driven-architecture', title: 'Event Sourcing & CQRS', description: 'Kafka streaming, materialized views, and immutable ledgers.' },
          { slug: 'p2p-protocols', title: 'Peer-to-Peer & DHT Networks', description: 'Kademlia, BitTorrent protocols, and decentralized gossip.' },
          { slug: 'database-internals', title: 'Database Engine Internals', description: 'LSM trees, B-Trees, WAL, and MVCC concurrency control.' },
          { slug: 'zero-knowledge-cryptography', title: 'Zero-Knowledge Cryptography', description: 'zk-SNARKs, polynomial commitments, and cryptographic proofs.' },
        
          { slug: 'vector-clocks-tracing', title: 'Vector Clocks & Distributed Tracing', description: 'Causal ordering, OpenTelemetry spans, and distributed latency.' },
          { slug: 'gossip-failure-detection', title: 'Gossip Protocols & Failure Detectors', description: 'SWIM protocol, phi-accrual detectors, and cluster state.' },
        ],
      },
      {
        slug: 'cybersecurity',
        title: 'Cybersecurity & Reverse Engineering',
        description: 'Binary exploitation, offensive security, and cryptography.',
        niches: [
          { slug: 'binary-exploitation', title: 'Binary Exploitation & PWN', description: 'ROP chains, heap exploitation, and memory corruption.' },
          { slug: 'reverse-engineering', title: 'Reverse Engineering & Disassembly', description: 'Ghidra, IDA Pro, and decompilation of firmware.' },
          { slug: 'cryptographic-attacks', title: 'Cryptanalysis & Attacks', description: 'Timing attacks, lattice reduction, and cipher cryptanalysis.' },
          { slug: 'malware-analysis', title: 'Malware Analysis & Sandboxing', description: 'Dynamic debugging, hooking, and behavioral heuristics.' },
          { slug: 'hardware-hacking', title: 'Hardware Hacking & Glitching', description: 'JTAG, UART tapping, and fault injection attacks.' },
          { slug: 'rf-security', title: 'SDR & Radio Frequency Security', description: 'Software-defined radio, sub-GHz reverse engineering, and ISM band.' },
        
          { slug: 'fuzzing-coverage-guided', title: 'Coverage-Guided Fuzzing (AFL++)', description: 'Corpus generation, mutation strategies, and ASAN instrumentation.' },
          { slug: 'hardware-side-channel', title: 'Side-Channel Attacks & Spectre', description: 'Cache timing attacks, speculative execution, and power analysis.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. MUSIC & SOUND PRODUCTION
  // -------------------------------------------------------------------------
  {
    slug: 'music-audio',
    title: 'Music & Sound Production',
    description: 'Synthesis, audio engineering, acoustic performance, and music composition.',
    icon: 'musical-notes-outline',
    topics: [
      {
        slug: 'electronic-synthesis',
        title: 'Synthesizers & Sound Design',
        description: 'Analog circuits, modular gear, and digital signal synthesis.',
        niches: [
          { slug: 'lo-fi-production', title: 'Lo-Fi Hip-Hop Production', description: 'SP-404 vinyl simulation, cassette saturation, and relaxed beat loops.' },
          { slug: 'modular-eurorack', title: 'Modular Eurorack Patching', description: 'Control voltage routing, generative sequencing, and wavefolders.' },
          { slug: 'fm-synthesis', title: 'FM Synthesis & Operator Design', description: 'Frequency modulation matrix algorithms and metallic timbres.' },
          { slug: 'ambient-drone-soundscapes', title: 'Ambient & Drone Soundscapes', description: 'Shimmer reverbs, granular delays, and spectral freezes.' },
          { slug: 'chiptune-8bit', title: 'Chiptune & 8-Bit Audio', description: 'Game Boy LSDJ, tracker music, and SID chip synthesis.' },
          { slug: 'analog-circuit-bending', title: 'Analog Circuit Bending', description: 'Short-circuiting toys and drum machines for glitch timbres.' },
        
          { slug: 'granular-synthesis-microsound', title: 'Granular Synthesis & Micro-Sampling', description: 'Grain envelope windows, spray jitter, and cloud density.' },
          { slug: 'analog-filter-ladder', title: 'Transistor Ladder Filters & Self-Oscillation', description: 'Moog 24dB/oct ladders, diode rings, and overdrive resonance.' },
        ],
      },
      {
        slug: 'audio-engineering',
        title: 'Audio Engineering & Acoustics',
        description: 'Mixing, mastering, microphone placement, and room acoustics.',
        niches: [
          { slug: 'analog-mastering', title: 'Analog Mastering Chains', description: 'Tube equalizers, diode bridge compressors, and tape saturation.' },
          { slug: 'spatial-audio-binaural', title: 'Spatial & Binaural Audio', description: 'Ambisonics, Dolby Atmos mixing, and HRTF 3D sound.' },
          { slug: 'microphone-techniques', title: 'Stereo Mic Techniques', description: 'Blumlein, Mid-Side, and Decca Tree recording configurations.' },
          { slug: 'drum-acoustics-tuning', title: 'Drum Acoustic Tuning', description: 'Drumhead dampening, phase alignment, and transient response.' },
          { slug: 'room-acoustics-treatment', title: 'Room Acoustics & Diffusion', description: 'Bass traps, Quadratic Residue Diffusers, and room modes.' },
        
          { slug: 'subwoofer-phase-alignment', title: 'Subwoofer Phase Alignment & FIR Filters', description: 'Impulse response timing, crossover slopes, and room correction.' },
          { slug: 'binaural-dummy-head-arrays', title: 'Dummy-Head Binaural Recording', description: 'Neumann KU-100 pinnae acoustics and HRTF 3D localization.' },
        ],
      },
      {
        slug: 'instrumental-craft',
        title: 'Instrumental Craft & Virtuosity',
        description: 'Advanced mechanics, fingerstyle, and acoustic mastery.',
        niches: [
          { slug: 'fingerstyle-acoustic-guitar', title: 'Per Дмитриcussive Fingerstyle Guitar', description: 'Slap harmonics, two-handed tapping, and alternate tunings.' },
          { slug: 'jazz-harmony-improvisation', title: 'Jazz Harmony & Improvisation', description: 'Coltrane changes, modal interchange, and altered scale licks.' },
          { slug: 'flamenco-guitar', title: 'Flamenco Guitar & Rasgueado', description: 'Compás rhythms, golpe technique, and bulerías mastery.' },
          { slug: 'classical-piano-interpretation', title: 'Classical Piano Polyphony', description: 'Bach fugue voicing, Chopin rubato, and pedal articulation.' },
          { slug: 'microtonal-composition', title: 'Microtonal & Xenharmonic Music', description: 'Just intonation, 31-EDO, and quarter-tone scales.' },
        
          { slug: 'slide-guitar-open-tunings', title: 'Slide Guitar & Open Tunings', description: 'Glass/brass slide intonation, damping, and DADGAD resonance.' },
          { slug: 'flamenco-compas-palos', title: 'Flamenco Compas & Palos', description: 'Solea, buleria, and rhythmic palm clapping (palmas).' },
        ],
      },
      {
        slug: 'experimental-audio',
        title: 'Experimental & Field Recording',
        description: 'Foley, hydrophones, and concrete music.',
        niches: [
          { slug: 'field-recording-soundscapes', title: 'Wilderness Field Recording', description: 'Hydrophone recording, ultrasonic bat detectors, and contact mics.' },
          { slug: 'musique-concrete-tape', title: 'Tape Loops & Musique Concrète', description: 'Physical magnetic tape splicing, reel-to-reel flanging, and decay.' },
          { slug: 'foley-art-sound-effects', title: 'Foley Art & Organic FX', description: 'Creating organic cinematic footsteps, cloth swishes, and impacts.' },
          { slug: 'procedural-game-audio', title: 'Procedural Game Audio', description: 'FMOD, Wwise real-time parameter controls, and dynamic sound engines.' },
        
          { slug: 'ultrasonic-bat-bioacoustics', title: 'Ultrasonic Bioacoustics', description: 'Time-expansion heterodyne detectors and echolocation chirps.' },
          { slug: 'hydrophone-subaquatic-audio', title: 'Subaquatic Hydrophone Recording', description: 'Piezoelectric underwater acoustics and ice cracking.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. FITNESS & MOVEMENT
  // -------------------------------------------------------------------------
  {
    slug: 'fitness-movement',
    title: 'Fitness & Movement',
    description: 'Strength training, gymnastics bodyweight, endurance, and human biomechanics.',
    icon: 'barbell-outline',
    topics: [
      {
        slug: 'calisthenics-gymnastics',
        title: 'Calisthenics & Gymnastics',
        description: 'Bodyweight leverage, hand balancing, and ring strength.',
        niches: [
          { slug: 'calisthenics-strength', title: 'Calisthenics & Street Workout', description: 'Progressive bodyweight overload, pull-up variations, and dip power.' },
          { slug: 'handstand-balancing', title: 'Handstand & Press Mechanics', description: 'Straight line form, shoulder flexion, and one-arm hand balancing.' },
          { slug: 'planche-lever-progression', title: 'Planche & Front Lever', description: 'Straight-arm scapular protraction, straddle progressions, and levers.' },
          { slug: 'gymnastic-rings-training', title: 'Gymnastic Rings Mastery', description: 'False grip, muscle-up transitions, and iron cross prep.' },
          { slug: 'mobility-joint-resilience', title: 'Joint Mobility & End-Range Strength', description: 'KOT protocols, Jefferson curls, and loaded hip mobility.' },
        
          { slug: 'human-flag-dragon-flag', title: 'Human Flag & Dragon Flag Leverage', description: 'Lateral chain oblique strength and core lever mechanics.' },
          { slug: 'manna-straddle-l-sit', title: 'Manna & Straddle L-Sit Compression', description: 'Pike flexibility, posterior shoulder extension, and hip flexors.' },
        ],
      },
      {
        slug: 'strength-powerlifting',
        title: 'Powerlifting & Strength Sports',
        description: 'Barbell mechanics, powerlifting, and maximal strength.',
        niches: [
          { slug: 'squat-biomechanics', title: 'Squat Biomechanics & Hip Anatomy', description: 'Low bar vs high bar leverage, ankle mobility, and bracing.' },
          { slug: 'deadlift-technique', title: 'Deadlift Setup & Slack Pulling', description: 'Sumo and conventional wedge mechanics, lat engagement, and lockout.' },
          { slug: 'olympic-weightlifting', title: 'Olympic Snatch & Clean-and-Jerk', description: 'Triple extension, bar trajectory, and rapid catch speed.' },
          { slug: 'strongman-events', title: 'Strongman Odd Object Lifting', description: 'Atlas stones, log press, farmer walks, and yoke carries.' },
          { slug: 'periodization-programming', title: 'Powerlifting Periodization', description: 'RPE autoregulation, block periodization, and peak tapers.' },
        
          { slug: 'grip-strength-pinch-blocks', title: 'Grip Strength & Pinch Block Loading', description: 'Crushing grip, hub lifting, and thick bar implements.' },
          { slug: 'belt-squat-spinal-decompression', title: 'Belt Squatting & Spinal Deloading', description: 'Quad hypertrophy without axial spinal fatigue.' },
        ],
      },
      {
        slug: 'endurance-aerobic',
        title: 'Endurance & Aerobic Performance',
        description: 'Zone 2 conditioning, ultra-marathons, and respiratory efficiency.',
        niches: [
          { slug: 'ultra-marathon-running', title: 'Ultra-Distance Trail Running', description: 'Mountain descents, pacing nutrition, and 100-mile endurance.' },
          { slug: 'zone-two-metabolism', title: 'Zone 2 Aerobic Base Training', description: 'Lactate threshold testing, mitochondrial density, and fat oxidation.' },
          { slug: 'triathlon-ironman-prep', title: 'Ironman Triathlon Training', description: 'Aero positioning, brick workouts, and open water swimming.' },
          { slug: 'breathing-mechanics-vo2', title: 'Respiratory Training & VO2 Max', description: 'Diaphragmatic pacing, hypoxic drills, and HIIT sprint intervals.' },
        
          { slug: 'cold-water-immersion-physiology', title: 'Cold Shock & Brown Adipose Activation', description: 'Norepinephrine spikes, cold thermogenesis, and recovery.' },
          { slug: 'high-altitude-hypoxic-training', title: 'High-Altitude Hypoxic Adaptation', description: 'EPO stimulation, hematocrit, and oxygen transport.' },
        ],
      },
      {
        slug: 'combat-athletics',
        title: 'Combat Sports & Martial Arts',
        description: 'Grappling, striking leverage, and fight conditioning.',
        niches: [
          { slug: 'bjj-grappling', title: 'Brazilian Jiu-Jitsu (No-Gi)', description: 'Leg entanglements, heel hooks, guard passing, and pressure passing.' },
          { slug: 'muay-thai-striking', title: 'Muay Thai & Clinch Warfare', description: 'Roundhouse kicking mechanics, sweeps, and elbow counters.' },
          { slug: 'boxing-footwork-angles', title: 'Boxing Footwork & Head Movement', description: 'Pivot mechanics, slip angles, and kinetic chain punch generation.' },
          { slug: 'judo-throw-mechanics', title: 'Judo Gripping & Kuzushi', description: 'Off-balancing mechanics, hip throws, and footsweeps.' },
        
          { slug: 'catch-wrestling-hooks', title: 'Catch Wrestling Submissions & Rides', description: 'Neck cranks, toe holds, and aggressive top pressure.' },
          { slug: 'capoeira-acrobatics-ginga', title: 'Capoeira Acrobatics & Ginga', description: 'Au batido, meia lua de compasso, and rhythm interaction.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. SCIENCE & NATURE
  // -------------------------------------------------------------------------
  {
    slug: 'science-nature',
    title: 'Science & Nature',
    description: 'Fundamental physics, biology, celestial mechanics, and natural history.',
    icon: 'planet-outline',
    topics: [
      {
        slug: 'astrophysics-space',
        title: 'Astrophysics & Space Exploration',
        description: 'Black holes, orbital mechanics, and cosmological evolution.',
        niches: [
          { slug: 'astrophotography-deep-sky', title: 'Deep-Sky Astrophotography', description: 'Narrowband hydrogen-alpha filtering, guiding mounts, and stacking.' },
          { slug: 'orbital-mechanics-rocketry', title: 'Orbital Mechanics & Delta-V', description: 'Hohmann transfers, Oberth effect, and propulsion staging.' },
          { slug: 'general-relativity-black-holes', title: 'General Relativity & Singularity Physics', description: 'Gravitational wave astronomy, frame dragging, and event horizons.' },
          { slug: 'exoplanet-spectroscopy', title: 'Exoplanet Atmospheric Spectroscopy', description: 'Transit transmission spectra, biosignatures, and stellar flares.' },
          { slug: 'cosmology-dark-matter', title: 'Cosmic Microwave Background & Dark Matter', description: 'Baryon acoustic oscillations, LCDM models, and expansion.' },
        
          { slug: 'gravitational-lensing-einstein-rings', title: 'Gravitational Lensing & Einstein Rings', description: 'Dark matter mapping, caustic curves, and magnification.' },
          { slug: 'radio-interferometry-vlbi', title: 'Very Long Baseline Interferometry (VLBI)', description: 'Event Horizon Telescope aperture synthesis and radio phases.' },
        ],
      },
      {
        slug: 'biology-genetics',
        title: 'Molecular Biology & Genetics',
        description: 'Synthetic biology, genomics, and cellular microbiology.',
        niches: [
          { slug: 'crispr-gene-editing', title: 'CRISPR & Epigenetic Regulation', description: 'Cas9 guide RNA design, prime editing, and methylation patterns.' },
          { slug: 'synthetic-biology-chassis', title: 'Synthetic Biology & Metabolic Engineering', description: 'Bacterial chassis design, BioBrick plasmids, and enzyme yields.' },
          { slug: 'neuroscience-synaptic-plasticity', title: 'Neuroscience & Synaptic Plasticity', description: 'Long-term potentiation, neural connectomes, and optogenetics.' },
          { slug: 'marine-deep-sea-biology', title: 'Abyssal Deep-Sea Biology', description: 'Hydrothermal vent extremophiles, bioluminescence, and benthic ecosystems.' },
        
          { slug: 'bacteriophage-therapy', title: 'Bacteriophage Engineering & Lytic Cycles', description: 'Targeted phage therapies against superbugs and bio-films.' },
          { slug: 'single-cell-rna-sequencing', title: 'Single-Cell RNA-Seq Transcriptomics', description: 'Microfluidic droplet barcoding and cellular heterogeneity.' },
        ],
      },
      {
        slug: 'quantum-physics',
        title: 'Quantum Mechanics & Condensed Matter',
        description: 'Superconductivity, quantum computers, and particle physics.',
        niches: [
          { slug: 'quantum-computing-qubits', title: 'Superconducting Qubits & Decoherence', description: 'Transmon qubits, quantum error correction, and dilution fridges.' },
          { slug: 'condensed-matter-physics', title: 'Superconductors & Topological Insulators', description: 'Meissner effect, Cooper pairing, and Majorana zero modes.' },
          { slug: 'particle-accelerators', title: 'Particle Physics & Collider Detectors', description: 'Standard Model anomalies, muon g-2, and calorimeter analysis.' },
          { slug: 'quantum-optics-entanglement', title: 'Quantum Optics & Bell Tests', description: 'Entangled photon pairs, spdc crystals, and quantum teleportation.' },
        
          { slug: 'nitrogen-vacancy-centers', title: 'Diamond Nitrogen-Vacancy Centers', description: 'Nanoscale magnetometry, quantum sensing, and spin qubits.' },
          { slug: 'topological-majorana-modes', title: 'Topological Quantum Computing', description: 'Non-Abelian anyons, braiding operations, and fault tolerance.' },
        ],
      },
      {
        slug: 'mathematics',
        title: 'Pure & Applied Mathematics',
        description: 'Topology, category theory, number theory, and dynamical systems.',
        niches: [
          { slug: 'algebraic-topology', title: 'Algebraic Topology & Homology', description: 'Fundamental groups, manifolds, and topological invariants.' },
          { slug: 'category-theory-monads', title: 'Category Theory & Functors', description: 'Adjunctions, commutative diagrams, and formal semantics.' },
          { slug: 'analytic-number-theory', title: 'Analytic Number Theory & Primes', description: 'Riemann zeta zeros, Dirichlet characters, and sieve methods.' },
          { slug: 'chaos-theory-fractals', title: 'Chaos Theory & Strange Attractors', description: 'Lorenz systems, bifurcation diagrams, and Mandelbrot math.' },
        
          { slug: 'riemannian-geometry-curvatures', title: 'Riemannian Geometry & Curvature', description: 'Geodesics, Ricci flow, Christoffel symbols, and metrics.' },
          { slug: 'p-adic-numbers-valuation', title: 'p-adic Analysis & Valuations', description: 'Hensel lemma, non-Archimedean metrics, and number theory.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. VISUAL ARTS & DESIGN
  // -------------------------------------------------------------------------
  {
    slug: 'visual-arts-design',
    title: 'Visual Arts & Design',
    description: 'Digital illustration, 3D modeling, typography, and industrial aesthetics.',
    icon: 'brush-outline',
    topics: [
      {
        slug: 'digital-concept-art',
        title: 'Digital Painting & Concept Art',
        description: 'Environment design, character silhouettes, and cinematic illustration.',
        niches: [
          { slug: 'sci-fi-environment-concept', title: 'Sci-Fi Environment Design', description: 'Worldbuilding panoramas, futuristic brutalism, and lighting keys.' },
          { slug: 'character-concept-costume', title: 'Character & Costume Silhouette', description: 'Anatomy stylization, visual rhythm, and materials rendering.' },
          { slug: 'matte-painting-vfx', title: 'Digital Matte Painting & Projection', description: 'Camera projection in Blender, plate cleanup, and atmospheric depth.' },
          { slug: 'digital-gouache-brushwork', title: 'Digital Gouache & Painterly Edge Control', description: 'Lost and found edges, impasto simulations, and color gamut.' },
        
          { slug: 'mecha-design-panel-lining', title: 'Hard Surface Mecha Design & Guts', description: 'Gundam aesthetics, hydraulic actuators, and decal placement.' },
          { slug: 'creature-zoology-concept', title: 'Speculative Creature Morphology', description: 'Evolutionary plausibility, muscle skeletal rigging, and textures.' },
        ],
      },
      {
        slug: 'three-d-cgi-vfx',
        title: '3D Modeling, Shading & VFX',
        description: 'Hard surface geometry, procedural shaders, and simulation.',
        niches: [
          { slug: 'hard-surface-subd', title: 'Hard Surface Sub-D Modeling', description: 'Topology edge loops, CAD booleans, and mechanical panelling.' },
          { slug: 'blender-geometry-nodes', title: 'Blender Procedural Geometry Nodes', description: 'Parametric generation, math nodes, and procedural scattering.' },
          { slug: 'substance-pbr-texturing', title: 'Photorealistic PBR Material Authoring', description: 'Micro-roughness maps, anisotropic reflections, and rust masks.' },
          { slug: 'houdini-fx-simulations', title: 'Houdini Pyro & Vellum Dynamics', description: 'VDB smoke simulations, cloth tearing, and flip fluids.' },
          { slug: 'stylized-hand-painted-3d', title: 'Stylized Hand-Painted 3D Assets', description: 'Low-poly baking, unlit diffuse painting, and cel-shading.' },
        
          { slug: 'ue5-nanite-lumen-tech', title: 'Unreal Engine 5 Nanite & Lumen Tech', description: 'Virtualised micro-polygon geometry and real-time global illumination.' },
          { slug: 'marvelous-designer-pattern-making', title: 'Digital Cloth Pattern Tailoring', description: 'Sewing patterns, fabric draping physics, and seam tension.' },
        ],
      },
      {
        slug: 'typography-graphic-design',
        title: 'Typography & Visual Identity',
        description: 'Type design, editorial layout, and experimental printmaking.',
        niches: [
          { slug: 'type-design-font-foundry', title: 'Bespoke Type Design & Kerning', description: 'Glyph bezier geometry, variable font axes, and optical sizing.' },
          { slug: 'swiss-international-style', title: 'Swiss Grid & International Typographic Style', description: 'Asymmetrical layout grids, high contrast hierarchy, and Helvetica.' },
          { slug: 'risograph-printmaking', title: 'Risograph Printmaking & Halftones', description: 'Soy ink layering, drum registration, and duotone poster art.' },
          { slug: 'generative-creative-coding', title: 'Generative Design & Creative Coding', description: 'Processing, p5.js algorithms, and vector SVG plotters.' },
        
          { slug: 'calligraphic-copperplate-script', title: 'Copperplate & Spencerian Calligraphy', description: 'Pointed pen nib flex, hairline swells, and arm movement.' },
          { slug: 'opentype-variable-axes', title: 'OpenType Font Engineering & Variable Axes', description: 'Weight, width, optical size, and glyph outline hinting.' },
        ],
      },
      {
        slug: 'photography-optics',
        title: 'Photography & Analog Processing',
        description: 'Darkroom chemistry, manual lenses, and medium format.',
        niches: [
          { slug: 'medium-format-film', title: 'Medium Format 120 Film Photography', description: 'Hasselblad 500C framing, Portra 400 emulsions, and scanning.' },
          { slug: 'black-white-darkroom', title: 'Gelatin Silver Darkroom Printing', description: 'Split-grade enlarging, selenium toning, and fiber paper washing.' },
          { slug: 'street-photography-rangefinder', title: 'Rangefinder Street Photography', description: 'Zone focusing, candid timing, and 35mm framing.' },
          { slug: 'large-format-tilt-shift', title: 'Large Format 4x5 View Camera Optics', description: 'Scheimpflug principle, bellows movements, and perspective shifts.' },
        
          { slug: 'wet-plate-collodion-tintype', title: 'Wet Plate Collodion Tintypes', description: 'Pouring ether collodion, silver nitrate bath, and cyanide fixing.' },
          { slug: 'cyanotype-platinum-palladium', title: 'Alternative UV Printing (Platinum/Palladium)', description: 'Noble metal emulsion coating, sunlight contact printing.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 6. CULINARY ARTS & GASTRONOMY
  // -------------------------------------------------------------------------
  {
    slug: 'culinary-gastronomy',
    title: 'Culinary Arts & Gastronomy',
    description: 'Fermentation microbiology, artisanal baking, specialty coffee, and kitchen science.',
    icon: 'restaurant-outline',
    topics: [
      {
        slug: 'fermentation-bread',
        title: 'Fermentation & Sourdough Baking',
        description: 'Wild yeasts, koji inoculations, and high-hydration doughs.',
        niches: [
          { slug: 'sourdough-microbiology', title: 'High-Hydration Sourdough Baking', description: 'Lactobacillus fermentation, open crumb structure, and Dutch oven baking.' },
          { slug: 'koji-miso-fermentation', title: 'Koji (Aspergillus Oryzae) Culturing', description: 'Inoculating grains, shio koji marinades, and multi-year miso ferments.' },
          { slug: 'artisan-cheesemaking', title: 'Artisanal Raw-Milk Cheesemaking', description: 'Rennet coagulation, affineur cave aging, and rind flora.' },
          { slug: 'wild-charcuterie-curing', title: 'Whole-Muscle Salumi & Charcuterie', description: 'Water activity monitoring, curing salts, and cellar humidity.' },
          { slug: 'vinegar-kombucha-brewing', title: 'Acetobacter Wild Vinegars & Kombucha', description: 'Mother of vinegar cultivation, acid titration, and secondary flavor.' },
        
          { slug: 'panettone-pasta-madre', title: 'Panettone Pasta Madre Fermentation', description: 'Legatura bound starter, high yolk emulsions, and acidity control.' },
          { slug: 'ancient-heritage-grains-baking', title: 'Heritage Wheats (Einkorn & Emmer)', description: 'Low-gluten dough handling, nutty flavor profiles, and hearth baking.' },
        ],
      },
      {
        slug: 'specialty-coffee-tea',
        title: 'Specialty Coffee & Gongfu Tea',
        description: 'Origin extraction, water chemistry, and sensory analysis.',
        niches: [
          { slug: 'espresso-fluid-dynamics', title: 'Espresso Fluid Dynamics & Profiling', description: '9-bar pressure profiling, flow rate tracking, and TDS extraction yields.' },
          { slug: 'pourover-water-chemistry', title: 'Pourover Extraction & Water Mineralogy', description: 'GH/KH mineral recipes, pour agitation kinetics, and flat burrs.' },
          { slug: 'gongfu-tea-brewing', title: 'Gongfu Tea & Aged Pu-erh', description: 'Yixing clay teapot seasoning, Gaiwan pours, and Cha Qi evaluation.' },
          { slug: 'coffee-bean-roasting', title: 'Small-Batch Drum Coffee Roasting', description: 'Rate of Rise (RoR) curves, first crack timing, and roast development.' },
        
          { slug: 'freeze-distilled-milk-coffee', title: 'Freeze-Distilled Milk Concentration', description: 'Lactose/protein cryo-concentration for velvety flat whites.' },
          { slug: 'cascara-coffee-fruit-brewing', title: 'Cascara Coffee Cherry Infusions', description: 'Drying coffee pulps, floral acidity, and antioxidant tea.' },
        ],
      },
      {
        slug: 'modernist-cooking',
        title: 'Molecular Gastronomy & Food Science',
        description: 'Hydrocolloids, precision thermal baths, and enzymatic extraction.',
        niches: [
          { slug: 'sous-vide-thermal-denaturation', title: 'Precision Thermal Sous-Vide Cooking', description: 'Collagen breakdown temps, equilibrium brining, and sear crusts.' },
          { slug: 'hydrocolloids-spherification', title: 'Hydrocolloids & Reverse Spherification', description: 'Sodium alginate baths, agar gel fluid gels, and xantham stability.' },
          { slug: 'rotary-evaporation-flavor', title: 'Rotovap & Ultrasonic Flavor Extraction', description: 'Vacuum distillation of aromatics without thermal degradation.' },
          { slug: 'smoke-emulsions-charcoal', title: 'Binchotan Charcoal & High-Heat Grilling', description: 'Yakitori skewering, near-infrared charcoal heat, and tare sauces.' },
        
          { slug: 'centrifugal-juice-clarification', title: 'Centrifugal Clarification & Pectinex', description: 'Spinning purees at 4000g for crystal-clear aromatics.' },
          { slug: 'transglutaminase-meat-glue', title: 'Enzymatic Meat Binding (Transglutaminase)', description: 'Covalent protein bonds, cross-linking, and seamless roasts.' },
        ],
      },
      {
        slug: 'global-pastry-chocolate',
        title: 'Chocolaterie & French Viennoiserie',
        description: 'Cacao crystallisation, lamination folds, and confections.',
        niches: [
          { slug: 'bean-to-bar-chocolate', title: 'Bean-to-Bar Craft Chocolate', description: 'Stone conching, cocoa butter beta-V polymorphic tempering, and origins.' },
          { slug: 'croissant-lamination', title: 'Laminated Croissant Dough', description: 'Enbeurrage folds, butter plasticity, honeycomb internal alveoli.' },
          { slug: 'confectionery-sugar-work', title: 'Sugar Pulling & High-End Confections', description: 'Isomalt blowing, caramel temperature stages, and fruit pates.' },
        
          { slug: 'kouign-amann-caramelized-lamination', title: 'Kouign-Amann Sugar Lamination', description: 'Folding granulated sugar into butter layers for salted caramel crust.' },
          { slug: 'bean-roast-polyphenol-cacao', title: 'Cacao Polyphenol Profiling & Ferment', description: 'Sweatbox pulp fermentation, roasting curves, and astringency.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 7. CRAFT & FABRICATION
  // -------------------------------------------------------------------------
  {
    slug: 'craft-fabrication',
    title: 'Craft & Fabrication',
    description: 'Precision woodworking, metallurgy, horology, and physical engineering.',
    icon: 'construct-outline',
    topics: [
      {
        slug: 'woodworking-joinery',
        title: 'Precision Woodworking & Joinery',
        description: 'Hand planes, traditional Japanese timber framing, and fine furniture.',
        niches: [
          { slug: 'japanese-timber-joinery', title: 'Japanese Sashimono & Timber Joinery', description: 'Kanawa-tsugi splicing, mortise and tenon without metal fasteners.' },
          { slug: 'hand-tool-woodworking', title: 'Hand Plane Tuning & Dovetails', description: 'Flattening soles, sharpening A2 tool steel, and through-dovetails.' },
          { slug: 'wood-turning-lathe', title: 'Green Wood Turning & Lathe Bowls', description: 'Bowl gouge cuts, end-grain hollow forms, and live-edge natural rims.' },
          { slug: 'luthiery-acoustic-build', title: 'Luthiery & Acoustic Instrument Making', description: 'Tap tuning soundboards, kerfing, and rosette marquetry inlays.' },
        
          { slug: 'kumiko-geometric-lattice', title: 'Kumiko Geometric Wood Lattice Craft', description: 'Asanoha hemp patterns, guide blocks, and chisel mitres.' },
          { slug: 'french-polishing-shellac', title: 'French Polishing & Shellac Finishing', description: 'Fad rubbing, spiriting off, and mirror optical gloss.' },
        ],
      },
      {
        slug: 'metalworking-smithing',
        title: 'Blacksmithing & Metallurgy',
        description: 'Forging, pattern-welded damascus, and precision machining.',
        niches: [
          { slug: 'damascus-steel-forging', title: 'Pattern-Welded Damascus Steel', description: 'Billet forge welding, acid etching grain patterns, and heat treats.' },
          { slug: 'manual-lathe-machining', title: 'Manual Metal Lathe & Mill Machining', description: 'Dial indicator centering, single-point threading, and zero-backlash.' },
          { slug: 'tig-welding-exotic', title: 'Sanitary TIG Welding (Stainless & Titanium)', description: 'Argon back-purging, pulse frequency settings, and rainbow beads.' },
          { slug: 'knife-grinding-geometry', title: 'Custom Knifemaking & Bevel Grinding', description: 'Platen convex grinding, edge apexing, and Rockwell C hardness.' },
        
          { slug: 'mokume-gane-billet-smithing', title: 'Mokume-Gane Diffusion Bonding', description: 'Solid-state fusing of copper/silver layers and carved swirls.' },
          { slug: 'lost-wax-bronze-casting', title: 'Lost-Wax Precision Bronze Casting', description: 'Spruing, ceramic shell investment, and crucible pour heat.' },
        ],
      },
      {
        slug: 'maker-electronics',
        title: 'Physical Computing & Electronics DIY',
        description: 'PCB design, custom keyboards, and mechanical linkages.',
        niches: [
          { slug: 'custom-mechanical-keyboards', title: 'Custom Mechanical Keyboards', description: 'Lubing Krytox 205g0 switches, gasket mounts, and FR4 plate acoustics.' },
          { slug: 'pcb-kicad-design', title: 'KiCad High-Speed PCB Layout', description: 'Differential pair routing, ground planes, and SMD reflow soldering.' },
          { slug: 'voron-corexy-3d-printing', title: 'CoreXY DIY 3D Printers (Voron)', description: 'Klipper input shaping, linear rails tuning, and high-temp printing.' },
          { slug: 'nixie-tube-clocks', title: 'Nixie Tube & Vintage Display Electronics', description: 'High-voltage boost converter circuits and multiplexing cathode glow.' },
        
          { slug: 'analog-vco-discrete-tuning', title: 'Discrete Transistor VCO Calibration', description: 'Matched pairs, tempco resistors, and 1V/Octave tracking.' },
          { slug: 'retro-crt-scanline-generators', title: 'Video Scanline Generators & DACs', description: 'Resistor ladder video DACs and FPGA sync combiners.' },
        ],
      },
      {
        slug: 'leathercraft-horology',
        title: 'Horology & Bespoke Leathercraft',
        description: 'Mechanical watch servicing and saddle-stitched leather goods.',
        niches: [
          { slug: 'mechanical-watch-repair', title: 'Horology & Mechanical Movement Servicing', description: 'Escapement cleaning, balance spring truing, and micro-oiling jewels.' },
          { slug: 'saddle-stitch-leather', title: 'Hand-Stitched Leathercraft', description: 'Pricking iron spacing, fil au chinois wax threads, and edge burnishing.' },
          { slug: 'bookbinding-handcrafted', title: 'Traditional Leather Bookbinding', description: 'French link stitching, marbling paper edges, and gold leaf tooling.' },
        
          { slug: 'guilloche-rose-engine-dial', title: 'Guilloché Rose Engine Dial Turning', description: 'Straight-line engine engraving, moiré patterns, and enamel champlevé.' },
          { slug: 'tourbillon-escapement-poising', title: 'Tourbillon Escapement Balancing', description: 'Centering gravity errors and adjusting tiny gold timing screws.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 8. GAMING & INTERACTIVE MEDIA
  // -------------------------------------------------------------------------
  {
    slug: 'gaming-interactive',
    title: 'Gaming & Interactive Media',
    description: 'Game engine mechanics, speedrunning, competitive esports, and tabletop design.',
    icon: 'game-controller-outline',
    topics: [
      {
        slug: 'game-development-design',
        title: 'Game Architecture & Level Design',
        description: 'ECS architecture, shader programming, and player psychology.',
        niches: [
          { slug: 'shader-hlsl-glsl', title: 'HLSL/GLSL Shader Programming', description: 'Raymarching signed distance fields, vertex wind, and screen-space shaders.' },
          { slug: 'procedural-world-generation', title: 'Procedural Level Generation', description: 'Wave Function Collapse algorithms, Perlin noise biomes, and seeds.' },
          { slug: 'retro-pixel-art-animation', title: 'Retro Pixel Art & Sub-Pixel Animation', description: 'Limited color palettes, dithering, and sprite walk cycles.' },
          { slug: 'combat-frame-data-design', title: 'Action Combat & Frame Data Design', description: 'Hitbox validation, startup/active/recovery frames, and hitstop.' },
        
          { slug: 'inverse-kinematics-ragdoll', title: 'Inverse Kinematics (FABRIK/CCDIK)', description: 'Foot placement on uneven terrain and natural reach poses.' },
          { slug: 'spatial-hash-broadphase-collision', title: 'Spatial Hashing & Grid Partitions', description: 'Broad-phase collision optimization for 10,000+ entities.' },
        ],
      },
      {
        slug: 'speedrunning-retro',
        title: 'Speedrunning & Retro Engineering',
        description: 'Memory glitches, frame-perfect inputs, and emulator preservation.',
        niches: [
          { slug: 'retro-speedrun-glitches', title: 'Speedrunning Memory Manipulation', description: 'Arbitrary code execution, subpixel boundary clipping, and RNG routing.' },
          { slug: 'crt-gaming-rgb-hardware', title: 'CRT Monitors & RGB Video Hardware', description: 'PVM/BVM displays, RGB SCART cabling, and 240p test suites.' },
          { slug: 'fpga-retro-consoles', title: 'FPGA Hardware Simulation (MiSTer)', description: 'Cycle-accurate verilog console cores without software emulator lag.' },
          { slug: 'arcade-cabinet-restoration', title: 'Arcade PCB & Cabinet Restoration', description: 'Capacitor kit soldering, JAMMA harnesses, and Sanwa joystick microswitches.' },
        
          { slug: 'gba-arm7-assembly-hacking', title: 'GBA ARM7 Assembly ROM Hacking', description: 'Disassembling bytecode, RAM injection, and custom patch IPS.' },
          { slug: 'phosphor-decay-shader-emulation', title: 'Phosphor Decay & Trinitron Emulation', description: 'Aperture grille masks, bloom dispersion, and scanline shaders.' },
        ],
      },
      {
        slug: 'competitive-esports',
        title: 'Competitive Esports Strategy',
        description: 'RTS mechanics, tactical shooters, and fighting game theory.',
        niches: [
          { slug: 'fighting-game-footsies', title: 'Fighting Game Mindgames & Footsies', description: 'Whiff punishing, okizeme setups, option selects, and matchup knowledge.' },
          { slug: 'rts-macro-micro-apm', title: 'RTS Macro Mechanics & Build Orders', description: 'StarCraft supply timings, worker distribution, and split micro.' },
          { slug: 'tactical-fps-utility', title: 'Tactical Shooter Lineups & Utility', description: 'Crosshair placement, smoke/flash grenade lineups, and site retakes.' },
        
          { slug: 'moba-wave-management-freezing', title: 'MOBA Minion Wave Freezing & Slow-Pushes', description: 'Minion collision, crash timings, and vision denial.' },
          { slug: 'sim-racing-pedal-telemetry', title: 'Sim Racing Load-Cell Telemetry & Trail Braking', description: 'MoTeC data analysis, weight transfer, and slip angle friction.' },
        ],
      },
      {
        slug: 'tabletop-rpg-design',
        title: 'Tabletop RPG Systems & Worldbuilding',
        description: 'Dice probability curves, narrative mechanics, and miniature painting.',
        niches: [
          { slug: 'ttrpg-ruleset-design', title: 'TTRPG Ruleset & Dice Probability', description: '2d6 bell curves vs d20 swinginess, narrative clocks, and PBTA hacks.' },
          { slug: 'miniature-nmm-painting', title: 'Miniature Non-Metallic Metal (NMM)', description: 'Simulating chrome reflections with matte paints, feathering, and glaze.' },
          { slug: 'modular-dungeon-crafting', title: 'Modular XPS Foam Dungeon Crafting', description: 'Hot-wire foam sculpting, stone texture rolling, and dry brushing.' },
        
          { slug: 'object-source-lighting-miniature', title: 'Miniature Object Source Lighting (OSL)', description: 'Illuminating armor from glowing plasma swords and torches.' },
          { slug: 'water-resin-diorama-effects', title: 'Two-Part Epoxy Water & Splash Sculpting', description: 'Pour depths, meniscus curing, and cotton wave froth.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 9. PHILOSOPHY & PSYCHOLOGY
  // -------------------------------------------------------------------------
  {
    slug: 'philosophy-psychology',
    title: 'Philosophy & Psychology',
    description: 'Epistemology, cognitive biases, ethics, and ancient schools of thought.',
    icon: 'library-outline',
    topics: [
      {
        slug: 'ancient-philosophy',
        title: 'Ancient Philosophy & Stoicism',
        description: 'Hellenistic ethics, Eastern dialectics, and contemplative practices.',
        niches: [
          { slug: 'stoic-virtue-epictetus', title: 'Stoic Logic & Dichotomy of Control', description: 'Epictetus, Marcus Aurelius meditations, and apatheia resilience.' },
          { slug: 'daoist-wu-wei-action', title: 'Daoist Philosophy & Wu Wei', description: 'Laozi, Zhuangzi parables, and effortless spontaneity in thought.' },
          { slug: 'presocratic-metaphysics', title: 'Pre-Socratic Metaphysics & Heraclitus', description: 'The flux of reality, logos, and cosmological fragments.' },
          { slug: 'buddhist-madhyamaka-logic', title: 'Madhyamaka & Emptiness Dialectics', description: 'Nagarjuna tetralemma, dependent origination, and perception.' },
        
          { slug: 'pyrrhonian-skepticism-epoche', title: 'Pyrrhonian Skepticism & Epoché', description: 'Suspension of judgement, ataraxia calmness, and tropes.' },
          { slug: 'neo-platonism-the-one-plotinus', title: 'Neoplatonism & Plotinus Emanations', description: 'The One, Nous intellect, world soul, and mystical henosis.' },
        ],
      },
      {
        slug: 'modern-epistemology',
        title: 'Epistemology & Philosophy of Mind',
        description: 'Consciousness, theories of knowledge, and scientific realism.',
        niches: [
          { slug: 'hard-problem-consciousness', title: 'The Hard Problem of Consciousness', description: 'Qualia, panpsychism, integrated information theory, and Chalmers.' },
          { slug: 'bayesian-epistemology', title: 'Bayesian Rationality & Probability Updating', description: 'Prior beliefs, evidence weighting, and cognitive bias avoidance.' },
          { slug: 'phenomenology-heidegger', title: 'Phenomenology & Being-in-the-World', description: 'Husserl intentionality, Heidegger Dasein, and Merleau-Ponty.' },
          { slug: 'existential-absurdism-camus', title: 'Existentialism & Absurdist Rebellion', description: 'Camus Myth of Sisyphus, Sartre radical freedom, and Kierkegaard.' },
        
          { slug: 'kuhnian-paradigm-shifts', title: 'Epistemological Paradigm Shifts (Kuhn)', description: 'Normal science, incommensurability, and revolutionary ruptures.' },
          { slug: 'post-structuralist-semiotics', title: 'Semiotic Deconstruction & Signs (Derrida)', description: 'Différance, signifiers, and critique of logocentrism.' },
        ],
      },
      {
        slug: 'cognitive-psychology',
        title: 'Cognitive Science & Behavioral Economics',
        description: 'Decision architectures, memory consolidation, and perception.',
        niches: [
          { slug: 'heuristics-biases-kahneman', title: 'Behavioral Heuristics & System 1/2', description: 'Prospect theory, loss aversion, and cognitive framing effects.' },
          { slug: 'neurobiology-memory-sleep', title: 'Memory Consolidation & Sleep Cycles', description: 'Slow-wave sleep ripples, synaptic pruning, and hippocampus recall.' },
          { slug: 'flow-state-performance', title: 'Flow State & Autotelic Motivation', description: 'Challenge-skill balance, transient hypofrontality, and deep work.' },
        
          { slug: 'dual-task-interference-executive', title: 'Executive Function & Working Memory Span', description: 'Phonological loop, central executive, and cognitive load.' },
          { slug: 'interoception-somatic-markers', title: 'Interoception & Somatic Marker Hypothesis', description: 'Insular cortex visceral feedback in rapid intuitive choices.' },
        ],
      },
      {
        slug: 'ethics-technology',
        title: 'Philosophy of Technology & Ethics',
        description: 'AI alignment, posthumanism, and privacy frameworks.',
        niches: [
          { slug: 'ai-value-alignment-ethics', title: 'AI Alignment & Moral Patiency', description: 'Orthogonality thesis, instrumental convergence, and reward hacking.' },
          { slug: 'posthumanism-transhuman-theory', title: 'Posthumanism & Technological Singularity', description: 'Cyborg anthropology, substrate independence, and future humans.' },
          { slug: 'digital-privacy-cryptopunk', title: 'Cypherpunk Ethics & Information Freedom', description: 'Cryptographic autonomy, decentralisation, and panopticon critique.' },
        
          { slug: 'algorithmic-bias-fairness-auditing', title: 'Algorithmic Fairness & Bias Auditing', description: 'Demographic parity, equalized odds, and model explainability.' },
          { slug: 'digital-commons-copyleft-philosophy', title: 'The Digital Commons & Copyleft Ethics', description: 'Information abundance vs artificial scarcity and FLOSS.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 10. CINEMA & STORYTELLING
  // -------------------------------------------------------------------------
  {
    slug: 'cinema-storytelling',
    title: 'Cinema & Storytelling',
    description: 'Cinematography, narrative structure, color grading, and editorial pace.',
    icon: 'videocam-outline',
    topics: [
      {
        slug: 'cinematography-lighting',
        title: 'Cinematography & Lighting Design',
        description: 'Camera movement, three-point lighting, and anamorphic optics.',
        niches: [
          { slug: 'anamorphic-lens-characteristics', title: 'Anamorphic Lens Optics & Flares', description: 'Oval bokeh, horizontal streak flares, and 2.39:1 cinemascope.' },
          { slug: 'negative-fill-contrast-lighting', title: 'Low-Key Lighting & Negative Fill', description: 'Chiaroscuro, unbleached muslin diffusion, and contrast ratios.' },
          { slug: 'steadicam-camera-blocking', title: 'Gimbal & Steadicam Camera Blocking', description: 'Dynamic one-take tracking shots, operator footwork, and pacing.' },
          { slug: 'miniature-practical-effects', title: 'In-Camera Practical Special Effects', description: 'Forced perspective sets, squibs, and real physical explosions.' },
        
          { slug: 'split-diopter-deep-focus', title: 'Split Diopter Deep Focus Optics', description: 'Dual plane simultaneous sharpness, Hitchcock and De Palma.' },
          { slug: 'color-temperature-contrast-mired', title: 'Kelvin Temperature Contrast in Lighting', description: 'Tungsten/daylight mixing, mired shifts, and sodium vapor.' },
        ],
      },
      {
        slug: 'post-production-color',
        title: 'Color Grading & Editorial Rhythm',
        description: 'ACES color workflows, film emulation, and match cutting.',
        niches: [
          { slug: 'davinci-aces-color-science', title: 'ACES Pipeline & Film Look LUTs', description: 'Scene-referred grading, subtractive color density, and halation.' },
          { slug: 'pacing-film-montage', title: 'Editorial Montage & Spatial Continuity', description: 'Kuleshov effect, J-cuts, L-cuts, and rhythmic pacing in cuts.' },
          { slug: 'hdr-grading-dolby-vision', title: 'Dolby Vision HDR Mastering', description: '1000 nit highlights, color volume clipping, and tone mapping.' },
        
          { slug: 'french-new-wave-jump-cuts', title: 'French New Wave Jump Cuts & Rhythm', description: 'Godard editing, breaking 180-degree rule, and vitality.' },
          { slug: 'subtractive-color-density', title: 'Subtractive Color Density & Film Print Stock', description: 'Kodak 2383 print stock emulation and density rolloff.' },
        ],
      },
      {
        slug: 'screenwriting-dramaturgy',
        title: 'Screenwriting & Narrative Theory',
        description: 'Scene subtext, non-linear plot structures, and dialogue economy.',
        niches: [
          { slug: 'subtext-dialogue-craft', title: 'Subtext & Scene Tension Dynamics', description: 'What characters leave unsaid, dramatic irony, and power shifts.' },
          { slug: 'non-linear-narrative-timelines', title: 'Non-Linear & Multi-Strand Storytelling', description: 'Parallel timelines, flash-forwards, and thematic resonance.' },
          { slug: 'visual-storytelling-show-dont-tell', title: 'Visual Storytelling & Wordless Scenes', description: 'Conveying internal character arc strictly through camera and props.' },
        
          { slug: 'unreliable-narrator-psychology', title: 'The Unreliable Narrator & Subjective Truth', description: 'Memory decay, biased framing, and revelation pacing.' },
          { slug: 'midpoint-reversal-peripeteia', title: 'Midpoint Reversals & False Victories', description: 'Aristotelian peripeteia, raising stakes, and ticking clocks.' },
        ],
      },
      {
        slug: 'animation-stop-motion',
        title: 'Stop Motion & Puppet Fabrication',
        description: 'Armatures, claymation frame replacement, and set lighting.',
        niches: [
          { slug: 'ball-socket-armature-building', title: 'Ball-and-Socket Armature Fabrication', description: 'Machining stainless steel joints, tie-downs, and silicone skin.' },
          { slug: 'stop-motion-replacement-faces', title: 'Replacement 3D-Printed Facial Animation', description: 'Lip sync registration, frame-by-frame expression swaps.' },
          { slug: 'miniature-set-scenography', title: 'Stop-Motion Miniature Scenography', description: 'Weathering mini bricks, scale foliage, and focal depth scaling.' },
        
          { slug: 'claymation-metamorphosis-transitions', title: 'Claymation Morphing Transitions', description: 'Fluid transformation of plasticine figures without cuts.' },
          { slug: 'multiplane-camera-depth', title: 'Multiplane Camera Glass Layer Depth', description: 'Disney classic depth rigs, parallax layers, and backlighting.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 11. OUTDOOR & ADVENTURE
  // -------------------------------------------------------------------------
  {
    slug: 'outdoor-adventure',
    title: 'Outdoor & Adventure',
    description: 'Wilderness survival, rock climbing, bikepacking, and nautical exploration.',
    icon: 'compass-outline',
    topics: [
      {
        slug: 'climbing-mountaineering',
        title: 'Rock Climbing & Alpinism',
        description: 'Trad gear placement, bouldering movement, and alpine summits.',
        niches: [
          { slug: 'trad-climbing-gear-placement', title: 'Traditional (Trad) Gear Placement', description: 'Camming devices, passive stoppers, equalized anchor geometry.' },
          { slug: 'bouldering-movement-dynamics', title: 'Bouldering Dynamics & Drop Knees', description: 'Deadpoints, heel hooks, toe scums, and center of mass momentum.' },
          { slug: 'crevasse-rescue-glacier', title: 'Alpine Glacier Travel & Crevasse Rescue', description: 'Rope team spacing, z-pulley systems, and ice screw anchors.' },
          { slug: 'ice-climbing-tool-technique', title: 'Water Ice Climbing & Dry Tooling', description: 'Crampon mono-point kicks, ice axe swinging wrist flicks.' },
        
          { slug: 'crack-climbing-tape-gloves', title: 'Crack Climbing & Hand Jams', description: 'Hand cupping, finger locks, ring locks, and tape protection.' },
          { slug: 'off-width-stacking-technique', title: 'Off-Width Chimney & Stacking Tech', description: 'Heel-toe cams, chicken wings, and brutal friction climbing.' },
        ],
      },
      {
        slug: 'bushcraft-survival',
        title: 'Bushcraft & Wilderness Survival',
        description: 'Friction fire, shelter architecture, and backcountry navigation.',
        niches: [
          { slug: 'bow-drill-friction-fire', title: 'Bow Drill & Hand Drill Friction Fire', description: 'Tinder bundle preparation, spindle ember creation, wood selection.' },
          { slug: 'primitive-shelter-building', title: 'Debris Huts & Natural Cordage', description: 'Thermal insulation with dried leaves, nettle fiber cord twisting.' },
          { slug: 'topographic-map-compass', title: 'Orienteering & Dead Reckoning Navigation', description: 'Magnetic declination, resection bearing lines, terrain association.' },
          { slug: 'wild-foraging-ethnobotany', title: 'Wild Plant Foraging & Ethnobotany', description: 'Identifying medicinal herbs, edible mushrooms, spore prints.' },
        
          { slug: 'bark-tanning-hide-leather', title: 'Bark Tanning & Natural Brain Tanning', description: 'Oak tannin baths, scraping flesh, and smoke preservation.' },
          { slug: 'coal-burning-wood-spoons', title: 'Coal Burning Wooden Utensils & Bowls', description: 'Directing embers with blow pipes to hollow hard wood.' },
        ],
      },
      {
        slug: 'bikepacking-touring',
        title: 'Ultralight Bikepacking & Expedition',
        description: 'Gravel routes, gear packing distribution, and self-supported touring.',
        niches: [
          { slug: 'ultralight-gear-packing-bike', title: 'Ultralight Bikepacking Setup', description: 'Frame bag volume distribution, dynamo hub charging, dry bags.' },
          { slug: 'gravel-bike-geometry-mechanics', title: 'Gravel Rig Geometry & Tubeless Repairs', description: 'Tire clearance, low gearing 1x, bacon strips, tubeless sealant.' },
          { slug: 'off-grid-solar-purification', title: 'Off-Grid Wilderness Water Purification', description: 'Hollow fiber filters, UV sterilization, gravity bag setups.' },
        
          { slug: 'custom-framebag-myog-sewing', title: 'MYOG Custom Cordura Frame Bag Sewing', description: 'X-Pac materials, waterproof zippers, and laser cutting.' },
          { slug: 'dynamo-usb-power-hubs', title: 'Sturmey Archer & SON Dynamo Power Hubs', description: 'AC to DC rectification, buffer batteries, and low-speed charging.' },
        ],
      },
      {
        slug: 'marine-scuba-freediving',
        title: 'Scuba & Freediving Exploration',
        description: 'Breath-hold physiology, buoyancy, and marine navigation.',
        niches: [
          { slug: 'freediving-frenzel-equalization', title: 'Freediving Frenzel Equalization', description: 'Soft palate control, mammalian dive reflex, static apnea relax.' },
          { slug: 'tech-diving-trimix-decompression', title: 'Technical Scuba & Trimix Gas Blending', description: 'Decompression obligation ceiling, oxygen toxicity, staged deco.' },
          { slug: 'underwater-cave-mapping', title: 'Cave Diving Navigation & Reel Lines', description: 'Continuous guideline management, blind navigation, zero-vis silting.' },
        
          { slug: 'static-apnea-mental-drills', title: 'Static Apnea Mental Deconcentration', description: 'Heart rate deceleration, urge to breathe tolerance, and Zen.' },
          { slug: 'shipwreck-overhead-penetration', title: 'Overhead Shipwreck Penetration & Reels', description: 'Sharp hull hazards, tie-offs, and light failure drills.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 12. LITERATURE & WRITING
  // -------------------------------------------------------------------------
  {
    slug: 'literature-writing',
    title: 'Literature & Creative Writing',
    description: 'Speculative worldbuilding, poetic forms, narrative voice, and translation.',
    icon: 'book-outline',
    topics: [
      {
        slug: 'speculative-fiction',
        title: 'Speculative Fiction & Hard Sci-Fi',
        description: 'Worldbuilding consistency, Fermi paradox tales, and alien biologies.',
        niches: [
          { slug: 'hard-scifi-worldbuilding', title: 'Hard Sci-Fi Worldbuilding & Physics', description: 'Plausible physics, gravity habitats, space elevators, and lore.' },
          { slug: 'conlang-constructed-languages', title: 'Constructed Languages (Conlangs)', description: 'Phoneme inventory, agglutinative grammar, morphology design.' },
          { slug: 'solarpunk-optimistic-futures', title: 'Solarpunk & Ecological Speculative Fiction', description: 'Decentralized ecological utopias, permaculture communities.' },
          { slug: 'cyberpunk-high-tech-low-life', title: 'Cyberpunk & Neuromancer Aesthetics', description: 'Megacorporation hegemony, body augmentation, street neon ethos.' },
        
          { slug: 'dyson-swarm-megastructures', title: 'Dyson Swarms & Kardashev Scales', description: 'Stellar energy collection mirrors and megascale engineering.' },
          { slug: 'hive-mind-biological-societies', title: 'Eusocial Hive Minds in Speculative Lore', description: 'Pheromone communication, collective mind, and individuality.' },
        ],
      },
      {
        slug: 'poetry-poetics',
        title: 'Poetry & Classical Verse Forms',
        description: 'Meter, rhyme schemes, sensory imagery, and modernist free verse.',
        niches: [
          { slug: 'iambic-pentameter-sonnets', title: 'Sonnets, Villanes, & Metered Verse', description: 'Strict iambic scansion, volta turns, sestina permutations.' },
          { slug: 'japanese-haiku-wabi-sabi', title: 'Haiku, Tanka & Wabi-Sabi Imagery', description: 'Kireji cutting words, kigo season references, and brief simplicity.' },
          { slug: 'spoken-word-cadence-delivery', title: 'Spoken Word Poetry & Rhythmic Delivery', description: 'Internal rhyme, cadence accelerando, dynamic vocal volume.' },
        
          { slug: 'ghazal-couplets-refrains', title: 'Ghazal Couplets (Radif & Qafia)', description: 'Autonomous shers, repeating refrains, and mystical yearning.' },
          { slug: 'concrete-typographic-poetry', title: 'Concrete & Visual Spatial Poetry', description: 'Arranging letterforms into semantic physical shapes.' },
        ],
      },
      {
        slug: 'prose-stylistics',
        title: 'Prose Stylistics & Voice',
        description: 'Sentence rhythm, stream of consciousness, and aesthetic prose.',
        niches: [
          { slug: 'stream-of-consciousness-prose', title: 'Stream of Consciousness & Free Indirect Style', description: 'Syntactic flow, sensory associative jumps, Woolf & Joyce.' },
          { slug: 'minimalist-prose-hemingway', title: 'Minimalist Fiction & The Iceberg Theory', description: 'Crisp nouns, omission of adjectives, devastating understated tone.' },
          { slug: 'magical-realism-latin-american', title: 'Magical Realism & Mythic Atmosphere', description: 'Treating the extraordinary as mundane and mundane as wonder.' },
        
          { slug: 'epistolary-novel-documentation', title: 'Epistolary Prose & Found Documents', description: 'Telling stories through letters, field notes, and logs.' },
          { slug: 'chiasmus-parallel-rhetoric', title: 'Chiasmus & Antimetabole Sentence Rhythm', description: 'Inverted syntactic structures and symmetrical prose phrasing.' },
        ],
      },
      {
        slug: 'literary-translation-philology',
        title: 'Translation & Philology',
        description: 'Untranslatable idioms, ancient manuscripts, and historical linguistics.',
        niches: [
          { slug: 'poetic-translation-fidelity', title: 'Literary Translation & Cultural Equivalence', description: 'Translating meter without losing tone, nuance, or idiomatic weight.' },
          { slug: 'historical-linguistics-etymology', title: 'Historical Linguistics & Proto-Indo-European', description: 'Grimm\'s law, sound shifts, linguistic reconstruction of roots.' },
          { slug: 'palaeography-ancient-manuscripts', title: 'Palaeography & Manuscript Decipherment', description: 'Scribal ligatures, marginalia, illumination provenance.' },
        
          { slug: 'linear-b-cuneiform-epigraphy', title: 'Linear B & Sumerian Cuneiform Epigraphy', description: 'Deciphering clay tablets, phonetic syllabaries, and logs.' },
          { slug: 'hapax-legomena-philology', title: 'Hapax Legomena & Ancient Textual Corruptions', description: 'Single-occurrence biblical words, philological glosses.' },
        ],
      },
    ],
  },
];

/**
 * Builds the complete 3-level tree structure with deterministic 512-dimension unit vectors.
 */
export function buildTaxonomyTree(): InterestTaxonomyNode[] {
  return COMPREHENSIVE_TAXONOMY.map((root, rootIdx) => {
    const rootId = `10000000-0000-4000-a000-${String(rootIdx + 1).padStart(12, '0')}`;
    const rootVector = generateDeterministicUnitVector(root.slug);

    const children = root.topics.map((topic, topicIdx) => {
      const topicId = `20000000-0000-4000-b000-${String((rootIdx + 1) * 100 + topicIdx + 1).padStart(12, '0')}`;
      const topicVector = generateDeterministicUnitVector(topic.slug);

      const subChildren = topic.niches.map((niche, nicheIdx) => {
        const nicheId = `30000000-0000-4000-c000-${String((rootIdx + 1) * 10000 + (topicIdx + 1) * 100 + nicheIdx + 1).padStart(12, '0')}`;
        const nicheVector = generateDeterministicUnitVector(niche.slug);

        return {
          id: nicheId,
          slug: niche.slug,
          title: niche.title,
          description: niche.description,
          parentId: topicId,
          level: 2,
          vector: nicheVector,
        };
      });

      return {
        id: topicId,
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        parentId: rootId,
        level: 1,
        vector: topicVector,
        children: subChildren,
      };
    });

    return {
      id: rootId,
      slug: root.slug,
      title: root.title,
      description: root.description,
      parentId: null,
      level: 0,
      icon: root.icon,
      vector: rootVector,
      children,
    };
  });
}

/**
 * Returns a flat array of all taxonomy nodes (Categories, Topics, and Niches).
 */
export function getFlattenedTaxonomy(): Array<Omit<InterestTaxonomyNode, 'children'>> {
  const tree = buildTaxonomyTree();
  const flat: Array<Omit<InterestTaxonomyNode, 'children'>> = [];

  function traverse(node: InterestTaxonomyNode) {
    const { children, ...rest } = node;
    flat.push(rest);
    if (children && children.length > 0) {
      children.forEach(traverse);
    }
  }

  tree.forEach(traverse);
  return flat;
}

export const RAW_TAXONOMY = COMPREHENSIVE_TAXONOMY;
