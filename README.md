# VERITY // I KNOW EVERYTHING

Fan game de horror psicológico para navegador, inspirado no conceito da esfera amarela Verity popularizada pela série de Minecraft do ThatMob. Todo o código, UI e desenho procedural deste projeto foram feitos do zero para esta versão.

**Jogar:** https://mt2468.github.io/verity-browser-horror/

## O jogo

A campanha é dividida em seis dias. Verity começa como uma companheira prestativa e, a cada dia, a relação muda: sinais impossíveis aparecem, a floresta escurece, entidades passam a seguir o jogador e a própria Verity deixa de agir como uma amiga.

- Dia 1: localizar fragmentos de sinal.
- Dia 2: investigar marcas que não deveriam existir.
- Dia 3: restaurar luz enquanto sombras começam a aparecer.
- Dia 4: sobreviver a uma noite de perseguição.
- Dia 5: romper a conexão de Verity.
- Dia 6: destruir as âncoras, encontrar a saída e alcançar um dos finais.

## Controles

| Ação | Teclado |
| --- | --- |
| Movimento | WASD ou setas |
| Correr | Shift |
| Interagir | E |
| Lanterna | F |
| Pulso de sinal | Q |
| Arquivo de memória | J |
| Pausa | Esc |

Também há movimento por clique/toque e controles compactos em telas touch.

### Preferências de acessibilidade

A build 0.8.0 adiciona um painel persistente de preferências, disponível tanto na tela inicial quanto durante a pausa. Há três opções independentes: contraste alto, texto maior e suavização dos efeitos de horror. As opções são salvas localmente, têm diálogo modal com gerenciamento de foco e navegação por teclado e não alteram a dificuldade. A suavização reduz scanlines, flashes, vinheta e animações bruscas sem remover objetivos ou ameaças. O modo de teste `?qa=1` mantém essas preferências fora do armazenamento permanente.

### Pulso de sinal

O pulso é uma ferramenta de risco e recompensa: ele revela por um curto período objetivos e ameaças próximas, além de informar a distância do eco mais próximo. Em troca, aumenta o nível de sinal, possui recarga de 8 segundos e deixa sombras atingidas pelo pulso ligeiramente mais rápidas. O sistema bloqueia o uso quando o sinal já está saturado, então não substitui exploração cuidadosa.

### Arquivo de memória

O arquivo adiciona uma camada de metaprogressão narrativa. O primeiro objetivo concluído de cada dia recupera um registro de memória de Verity; o Dia 4 recupera seu registro ao completar a noite. Esses seis fragmentos ficam preservados em `localStorage` mesmo entre sessões e podem ser lidos a qualquer momento com `J` ou pelo botão `ARQUIVO`. O painel é um diálogo acessível com foco preso enquanto aberto, suporte a teclado, contagem de registros, mensagens via `aria-live` e conteúdo bloqueado explicitamente indicado sem expor o texto antes da hora. Abrir o arquivo interrompe a movimentação do jogador sem destruir o estado da campanha.

### Diretor psicológico

A campanha possui um diretor de horror que introduz eventos contextuais sem depender de uma sequência fixa. Ele respeita o dia, o nível de sinal, pausa/transições e a preferência de movimento reduzido do sistema. A partir do segundo dia surgem ecos falsos; nos dias posteriores podem ocorrer aparições periféricas, quedas momentâneas de iluminação e falas adicionais de Verity. Esses eventos são espaçados por orçamento e cooldown para aumentar tensão sem transformar a tela em ruído constante. Em `?qa=1`, os eventos aleatórios ficam desativados e podem ser acionados manualmente pela API de QA, mantendo os testes determinísticos.

### Governador de desempenho

O governador adaptativo de efeitos mede o frame time em janelas móveis e usa histerese para alternar entre níveis `high`, `balanced` e `low` sem ficar oscilando a cada queda momentânea de FPS. Em hardware mais lento, scanlines, glitches e animações cosméticas são reduzidos antes de sacrificar a lógica do jogo. Quando o desempenho se recupera por várias janelas consecutivas, os efeitos retornam gradualmente. `prefers-reduced-motion` entra diretamente no nível mais leve e o modo QA não muda de qualidade durante o teste. Para depuração determinística, `?perf=high`, `?perf=balanced` e `?perf=low` forçam um nível específico.

### Relatório de sessão

Ao alcançar um final, o jogo apresenta um relatório local com tempo de sessão, maior dia alcançado, quedas, interações, pulsos usados e pico de sinal. O último relatório é preservado em `localStorage` e o runtime é reanexado corretamente quando a cena Phaser reinicia.

## Sistemas implementados

- mundo 2D procedural de 2600×1900;
- seis fases com objetivos e escalada de horror;
- IA de acompanhamento/perseguição para Verity;
- inimigos-sombra com agressividade variável;
- stamina, sinal/perigo, lanterna, pulso de sinal e save em `localStorage`;
- arquivo persistente com seis registros narrativos desbloqueáveis;
- diretor psicológico com eventos contextuais, ecos falsos, aparições e brownouts;
- governador adaptativo de efeitos com telemetria local de FPS e suporte a movimento reduzido;
- preferências persistentes de acessibilidade para contraste, tamanho de texto e intensidade de FX;
- relatório de sessão persistente;
- áudio sintetizado via Web Audio API, sem arquivos de áudio externos;
- HUD responsivo, scanlines, glitches e transições;
- dois desfechos;
- modo interno de QA que percorre a máquina de estados dos seis dias e valida runtimes auxiliares;
- GitHub Pages como build jogável.

## Estrutura

```text
index.html
styles.css
a11y.css
perf.css                    # redução adaptativa de efeitos
src/
  bootstrap.js              # captura do runtime, versão e tela de erro
  game.js                   # loop, campanha, IA e renderização procedural
  phaser-patches.js         # primitivas gráficas auxiliares
  player-preferences.js     # preferências persistentes e UI acessível
  runtime-enhancements.js   # touch, sprites e correções de runtime
  navigation-runtime.js     # bússola de objetivo resiliente a throttling
  signal-pulse.js           # habilidade de pulso com risco/recompensa
  psychological-director.js # diretor de horror e eventos contextuais
  memory-archive.js         # metaprogressão narrativa persistente e UI acessível
  session-recap.js          # telemetria local e relatório de sessão
  performance-governor.js   # medição de FPS, histerese e orçamento de FX
  qa.js                     # harness de teste opcional
  qa-stability.js           # verificação final após timers atrasados
```

O projeto usa Phaser 3.90 via CDN e JavaScript ES modules, sem etapa de build.

## QA

Para desenvolvimento, `?qa=1&autotest=1` habilita um painel que inicializa e valida os seis dias, objetivos, atores, perseguição final, limites de estado e o ciclo do pulso de sinal. O diretor psicológico detecta `qa=1`, suspende eventos aleatórios e expõe `window.__VERITY_DIRECTOR__` com estado e acionamento manual de beats para inspeção determinística. O governador expõe `window.__VERITY_PERF__`, o arquivo expõe `window.__VERITY_ARCHIVE__`, o relatório expõe `window.__VERITY_RECAP__` e as preferências expõem `window.__VERITY_PREFS__`. A etapa `STABILITY` espera cinco segundos depois da suíte principal e só produz `STABLE PASS` se o Dia 6 continuar ativo, não houver erro fatal, os runtimes de preferências e relatório responderem corretamente e a versão esperada estiver carregada.

## Aviso

Projeto de fã não oficial, sem afiliação com Mojang, Microsoft ou ThatMob. Não reutiliza assets do Minecraft nem dos mods de Verity.
