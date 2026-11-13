# W2a Bolso Inteligente

Crie uma aplicação web de finanças pessoais chamada **W2A Finanças**, em português do Brasil, para organizar receitas, despesas, contas, cartões, orçamentos e metas.

Quero uma primeira versão funcional, com dados persistidos, cálculos corretos e uma interface simples para usar diariamente no computador e no celular.

Use este texto como especificação do projeto. Implemente nesta ordem: estrutura visual e autenticação; contas, categorias e lançamentos; cartões e regras financeiras; dashboard, orçamentos, metas e relatórios. Valide cada etapa antes de avançar.

**1. Experiência e identidade visual**

Use um visual de aplicativo financeiro moderno, organizado e elegante:

- Fonte Poppins, valores financeiros alinhados e boa legibilidade.
- Azul principal `#0546DE`, sidebar `#0F172A`, fundo `#F8FAFC` e texto `#111827`.
- Verde para entradas e sucesso, vermelho para saídas e erros, âmbar para pendências. Combine cores com textos e ícones.
- Cards com bordas discretas, cantos arredondados e espaçamento consistente.
- Tema claro como padrão e opção de tema escuro com preferência salva.
- Sidebar no desktop e menu hambúrguer com painel lateral no celular.
- Menu: Dashboard, Lançamentos, Contas, Cartões, Orçamentos, Metas, Relatórios, Categorias e Configurações.
- Cada página com URL própria. Atualizar a página deve preservar a tela e os filtros ativos.
- Botão “Novo lançamento” acessível e botões de criação específicos em cada módulo.
- Formulários em modal no desktop e painel adaptado ao celular.
- Feedback de sucesso e erro por toast; erros de campos junto ao formulário.
- Busca, filtros, ordenação e paginação nas listagens.
- Estados de carregamento, erro, lista vazia e confirmação de exclusão.
- Navegação por teclado, foco visível, rótulos acessíveis e boa experiência a partir de 360 px.

**2. Autenticação e persistência**

Use a stack padrão do Lovable e seu backend integrado:

- Cadastro, login com e-mail e senha, recuperação de senha e logout.
- Rotas protegidas e sessão persistente.
- Cada usuário acessa exclusivamente seus dados. Aplique isolamento no banco com RLS e valide a propriedade dos registros relacionados.
- Estruture entidades para perfis, contas, categorias, lançamentos, transferências, recorrências, cartões, compras, parcelas, faturas, pagamentos de fatura, orçamentos e metas.
- Use migrações, integridade referencial e validações no backend.
- Guarde valores monetários em centavos inteiros e use cálculos exatos.
- Moeda BRL, formatação R$ 1.234,56, datas DD/MM/AAAA e fuso America/Sao_Paulo.
- Datas de vencimento devem manter o dia escolhido sem deslocamento de fuso.
- Use armazenamento local apenas para preferências visuais; mantenha os registros financeiros no banco.
- No primeiro acesso, oriente a criação de uma conta e de um lançamento.
- As finanças começam vazias; categorias sugeridas podem ser criadas automaticamente.
- Configurações para nome, tema e preferências de visualização.

**3. Contas e categorias**

Para contas:

- Cadastrar nome, instituição opcional, tipo — corrente, poupança ou carteira —, cor, saldo inicial e data desse saldo.
- Exibir saldo por conta e consolidado.
- Transferir valores entre contas próprias, registrando origem, destino, valor e data.
- Editar e arquivar contas preservando o histórico.
- Permitir exclusão definitiva somente quando não houver movimentações.
- Identificar o saldo inicial como saldo de abertura, sem contabilizá-lo como receita. Ele representa o valor imediatamente anterior às movimentações da data informada; validar lançamentos anteriores a essa data.

Para categorias:

- Criar e editar categorias de receita e despesa, com nome, ícone e cor.
- Sugerir: Salário, Freelance, Outros recebimentos, Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Compras e Assinaturas.
- Arquivar categorias usadas ou exigir reclassificação antes da exclusão.

**4. Lançamentos e recorrências**

Permitir criar, consultar, editar, cancelar e excluir receitas e despesas, contendo:

- Descrição, valor, categoria e observações.
- Data de competência, vencimento e data efetiva de pagamento ou recebimento.
- Conta para movimentações bancárias ou cartão para compras no crédito.
- Forma de pagamento: Pix, dinheiro, débito, crédito, boleto ou outra.
- Situação pendente, realizada ou cancelada. Exibir “atrasada” quando pendente e vencida.

Implementar também:

- Ações rápidas para receber, pagar e desfazer a baixa de movimentos bancários.
- Filtros por período, tipo, categoria, conta, cartão e situação.
- Recorrência mensal para salários, aluguel e assinaturas, com data de início e término opcional.
- Geração de ocorrências futuras sem duplicar registros quando a rotina for executada novamente.
- Para vencimentos no dia 29, 30 ou 31, usar o último dia disponível nos meses mais curtos, preservando o dia original nos meses seguintes.
- Ao editar ou cancelar uma série, permitir escolher “esta ocorrência” ou “esta e as próximas”. Preservar ocorrências já realizadas.
- Compras no cartão seguem o pagamento da fatura e não recebem baixa bancária individual.

**5. Cartões, parcelas e faturas**

Cadastrar cartões com nome, limite, dia de fechamento e dia de vencimento.

Implementar:

- Limite total, comprometido e disponível.
- Consulta da fatura selecionada e das parcelas futuras.
- Compras à vista no crédito ou parceladas, com descrição, categoria, data, valor total e quantidade de parcelas.
- O valor informado é o total da compra. Dividir em parcelas cuja soma seja exatamente esse total, distribuindo diferenças de centavos.
- Calcular a primeira fatura pelo ciclo do cartão, mostrar a previsão antes de salvar e permitir ajustar a primeira fatura.
- Regra inicial explícita: compras anteriores ao dia de fechamento entram no ciclo que fecha naquele mês; compras no dia do fechamento ou depois entram no próximo.
- O vencimento deve ocorrer após o fechamento. Quando um dia configurado não existir no mês, usar o último dia disponível.
- Cada parcela pertence a uma fatura e recebe identificação como “2/10”.
- O mês de competência da parcela é o mês de vencimento da sua fatura.
- Faturas com itens, total e estados aberta, fechada, parcialmente paga, paga e vencida, calculados por datas e pagamentos.
- Pagamento integral ou parcial, indicando conta de origem, valor e data. Mostrar o saldo restante.
- O limite comprometido considera todas as compras ainda não quitadas, incluindo parcelas futuras. Pagamentos e estornos liberam o valor correspondente.
- Estornos vinculados à compra original.
- Impedir pagamento duplicado, pagamento acima do saldo da fatura e alterações que corrompam parcelas já quitadas.

**6. Dashboard**

Ao entrar, mostrar:

- Saldo disponível hoje, somando os saldos bancários e da carteira.
- Receitas recebidas no mês.
- Saídas de caixa no mês.
- Valores a receber e a pagar no mês, incluindo o saldo pendente das faturas.
- Gráfico de receitas recebidas versus saídas de caixa nos últimos seis meses.
- Gastos por categoria no mês de competência.
- Próximos vencimentos, pendências atrasadas, faturas e últimos lançamentos.
- Progresso dos orçamentos e metas.
- Seletor de mês e ano para os indicadores mensais. O saldo atual deve permanecer identificado como “hoje”.
- Atalhos nos indicadores para abrir os registros que compõem cada total.

Todos os indicadores devem usar os dados cadastrados e respeitar os filtros e as regras financeiras.

**7. Orçamentos, metas e relatórios**

Orçamentos:

- Definir limite mensal por categoria de despesa.
- Mostrar comprometido, limite, restante e percentual utilizado.
- Considerar despesas válidas do mês de competência, pendentes ou realizadas, incluindo parcelas de cartão daquele mês.
- Sinalizar quando alcançar 80% e quando ultrapassar 100%.

Metas:

- Cadastrar nome, valor desejado, prazo opcional e descrição.
- Registrar aportes e retiradas com histórico e barra de progresso.
- Nesta versão, a meta representa um acompanhamento manual de valores reservados. Essas anotações não alteram saldos bancários nem geram despesas.

Relatórios:

- Oferecer visão de fluxo de caixa por data efetiva e visão de gastos por competência, claramente identificadas.
- Filtrar por período, conta, cartão e categoria quando aplicável.
- Mostrar totais, comparativos mensais, maiores categorias de gasto e tabela dos registros.
- Exportar a tabela filtrada em CSV UTF-8 compatível com Excel, com cabeçalhos em português, separador ponto e vírgula e valores no padrão brasileiro.

**8. Regras financeiras obrigatórias**

- Saldo de conta = abertura + entradas realizadas − saídas realizadas, incluindo transferências e pagamentos de fatura. Pendências afetam a previsão, não o saldo atual.
- Transferências entre contas próprias alteram os saldos das duas contas e ficam fora dos totais de receita e despesa.
- Uma compra no crédito gera compromisso no cartão. A saída da conta bancária acontece quando a fatura é paga.
- No fluxo de caixa, o pagamento da fatura aparece como saída; a compra no cartão não aparece como outra saída bancária.
- Nos gastos por categoria e orçamentos, contabilizar a compra ou parcela na competência definida. O pagamento da fatura não cria uma segunda despesa.
- Nos valores a pagar, somar despesas bancárias pendentes e saldo pendente das faturas, sem somar novamente as parcelas já incluídas nessas faturas.
- Cancelamentos, estornos e reversões devem atualizar saldos e relatórios de forma consistente.
- Operações relacionadas, como os dois lados de uma transferência e a baixa de uma fatura, devem ser atômicas.
- Repetir uma requisição ou clicar duas vezes não pode duplicar movimentos.
- Validar valor positivo, campos obrigatórios, datas e propriedade dos registros.
- Proteger divisões por zero e percentuais sem base de comparação.

**9. Validação e entrega**

Teste os fluxos principais com dados de teste separados dos dados reais:

- Conta com R$ 1.000,00, receita recebida de R$ 500,00 e despesa paga de R$ 200,00 resulta em R$ 1.300,00.
- Transferir R$ 300,00 para outra conta preserva o saldo consolidado.
- Compra de R$ 1.200,00 em três parcelas gera três parcelas de R$ 400,00 e compromete R$ 1.200,00 do limite.
- Pagar R$ 400,00 dessa fatura reduz o saldo bancário uma vez, deixa R$ 800,00 comprometidos no cartão e preserva os R$ 400,00 de gasto por competência daquele mês.
- Compra de R$ 100,00 em três parcelas mantém a soma exata de R$ 100,00.
- Verificar compra no dia do fechamento, virada de ano, fevereiro, pagamento parcial, estorno e recorrência executada duas vezes.
- Atualizar a página mantém dados, rota e filtros.
- Um usuário não consegue ler ou alterar registros de outro, inclusive por requisição direta ao backend.

Entregue os módulos funcionais, com operações conectadas ao banco e botões com ações completas. Revise a experiência no desktop e no celular, os erros do console, as permissões e os cálculos.

Ao terminar, informe o que foi implementado, os testes realizados e qualquer pendência real de configuração.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://w2a-bolso-inteligente.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/19e14752-f71b-4a74-89f9-be14882784b8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
