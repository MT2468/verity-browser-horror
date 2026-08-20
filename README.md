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
| Pausa | Esc |

Também há movimento por clique/toque e controles compactos em telas touch.

### Pulso de sinal

O pulso é uma ferramenta de risco e recompensa: ele revela por um curto período objetivos e ameaças próximas, além de informar a distância do eco mais próximo. Em troca, aumenta o nível de sinal, possui recarga de 8 segundos e deixa sombras atingidas pelo pulso ligeiramente mais rápidas. O sistema bloqueia o uso quando o sinal já está saturado, então não substitui exploração cuidadosa.

### Diretor psicológico

A campanha possui um diretor de horror que introduz eventos contextuais sem depender de uma sequência fixa. Ele respeita o dia, o nível de sinal, pausa/transições e a preferência de movimento reduzido do sistema. A partir do segundo dia surgem ecos falsos; nos dias posteriores podem ocorrer aparições periféricas, quedas momentâneas de iluminação e falas adicionais de Verity. Esses eventos são espaçados por orçamento e cooldown para aumentar tensão sem transformar a tela em ruído constante. Em `?qa=1`, os eventos aleatórios ficam desativados e podem ser acionados manualmente pela API de QA, mantendo os testes determinísticos.

### Governador de desempenho

A build 0.5.0 inclui um governador adaptativo de efeitos. Ele mede o frame time em janelas móveis e usa histerese para alternar entre níveis `high`, `balanced` e `low` sem ficar oscilando a cada queda momentânea de FPS. Em hardware mais lento, scanlines, glitches e animações cosméticas são reduzidos antes de sacrificar a lógica do jogo. Quando o desempenho se recupera por várias janelas consecutivas, os efeitos retornam gradualmente. `prefers-reduced-motion` entra diretamente no nível mais leve e o modo QA não muda de qualidade durante o teste. Para depuração determinística, `?perf=high`, `?perf=balanced` e `?perf=low` forçam um nível específico.

## Sistemas implementados

- mundo 2D procedural de 2600×1900;
- seis fases com objetivos e escalada de horror;
- IA de acompanhamento/perseguição para Verity;
- inimigos-sombra com agressividade variável;
- stamina, sinal/perigo, lanterna, pulso de sinal e save em `localStorage`;
- diretor psicológico com eventos contextuais, ecos falsos, aparições e brownouts;
- governador adaptativo de efeitos com telemetria local de FPS e suporte a movimento reduzido;
- áudio sintetizado via Web Audio API, sem arquivos de áudio externos;
- HUD responsivo, scanlines, glitches e transições;
- dois desfechos;
- modo interno de QA que percorre a máquina de estados dos seis dias e valida o pulso de sinal;
- GitHub Pages como build jogável.

## Estrutura

```text
index.html
styles.css
a11y.css
perf.css                    # redução adaptativa de efeitos
src/
  bootstrap.js              # captura do runtime e tela de erro
  game.js                   # loop, campanha, IA e renderização procedural
  phaser-patches.js         # primitivas gráficas auxiliares
  runtime-enhancements.js   # touch, sprites e correções de runtime
  navigation-runtime.js     # bússola de objetivo resiliente a throttling
  signal-pulse.js           # habilidade de pulso com risco/recompensa
  psychological-director.js # diretor de horror e eventos contextuais
  performance-governor.js   # medição de FPS, histerese e orçamento de FX
  qa.js                     # harness de teste opcional
  qa-stability.js           # verificação de estabilidade após o teste
```

O projeto usa Phaser 3.90 via CDN e JavaScript ES modules, sem etapa de build.

## QA

Para desenvolvimento, `?qa=1&autotest=1` habilita um painel que inicializa e valida os seis dias, objetivos, atores, perseguição final, limites de estado e o ciclo do pulso de sinal. Esse modo não aparece para jogadores normais. O diretor psicológico detecta `qa=1`, suspende eventos aleatórios e expõe `window.__VERITY_DIRECTOR__` com estado e acionamento manual de beats para inspeção determinística. O governador expõe `window.__VERITY_PERF__` para inspeção manual do nível, FPS estimado e orçamento de efeitos.

## Aviso

Projeto de fã não oficial, sem afiliação com Mojang, Microsoft ou ThatMob. Não reutiliza assets do Minecraft nem dos mods de Verity.
